import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { reportConfigs, ReportKey } from "../../utils/reportConfigs";
import { AppError } from "../../core/appError";
import prisma from "../../database/prisma";
import { buildCsvFilename, toCsv, CsvColumn } from "../../utils/csv";
import { buildBillingCalculationDetails } from "../../utils/billingCalculation";

const parseStatusFilter = (status?: string) => {
  if (!status) return [];
  return status
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const ensureAllowedStatus = (
  reportType: ReportKey,
  status: string[],
  allowed: string[],
) => {
  if (status.length === 0) return;
  const invalid = status.filter((s) => !allowed.includes(s));
  if (invalid.length > 0) {
    throw new AppError(
      `Invalid status for ${reportType}: ${invalid.join(", ")}`,
      400,
    );
  }
};

const buildDateFilter = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (startDate) {
    const d = new Date(startDate + "T00:00:00");
    filter.gte = d;
  }
  if (endDate) {
    const d = new Date(endDate + "T23:59:59.999");
    filter.lte = d;
  }
  return filter;
};

const getQualityRatesReport = async (query: any) => {
  const vendors = await prisma.user.findMany({
    where: { role: "VENDOR" },
    select: { id: true, name: true, factoryRateDiff: true },
    orderBy: { name: "asc" },
  });

  // If no vendors exist, fall back to a single "Rate" column (base rate).
  const baseOnly = vendors.length === 0;

  const createdAt = buildDateFilter(query.startDate, query.endDate);

  const rateQueryWhere: Prisma.QualityRateWhereInput = {
    ...(createdAt && { createdAt }),
    ...(query.isActive !== undefined && {
      isActive: String(query.isActive) === "true",
    }),
  };

  const rates = await prisma.qualityRate.findMany({
    where: rateQueryWhere,
    orderBy: { createdAt: "asc" },
  });

  const startDate = query.startDate
    ? new Date(query.startDate + "T00:00:00")
    : rates.length
      ? new Date(rates[0].createdAt)
      : null;
  const endDate = query.endDate
    ? new Date(query.endDate + "T23:59:59.999")
    : rates.length
      ? new Date(rates[rates.length - 1].createdAt)
      : null;

  if (!startDate || !endDate) return [];
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // Rate before start date for carry-forward
  const previousRate = await prisma.qualityRate.findFirst({
    where: { createdAt: { lt: startDate } },
    orderBy: { createdAt: "desc" },
  });

  if (!rates.length && !previousRate) return [];

  // Map date string -> rate value
  const pad = (n: number) => String(n).padStart(2, "0");
  const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const rateByDate = new Map<string, number>();
  for (const r of rates) {
    const key = toDateKey(r.createdAt);
    rateByDate.set(key, r.rate);
  }

  // Fill daily entries
  let currentRate = previousRate?.rate ?? (rates.length ? rates[0].rate : 0);
  const rows: Array<Record<string, any>> = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const key = toDateKey(cursor);
    if (rateByDate.has(key)) {
      currentRate = rateByDate.get(key)!;
    }
    const row: Record<string, any> = {
      date: `${cursor.getDate()}/${cursor.getMonth() + 1}/${cursor.getFullYear()}`,
      baseRate: currentRate,
    };
    if (baseOnly) {
      row["Rate"] = currentRate;
    } else {
      for (const vendor of vendors) {
        row[vendor.name] = currentRate + (vendor.factoryRateDiff || 0);
      }
    }
    rows.push(row);
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows.reverse();
};

const getBillsReport = async (query: any) => {
  const createdAt = buildDateFilter(query.startDate, query.endDate);
  const status = parseStatusFilter(query.status);
  ensureAllowedStatus("bills", status, [
    "DRAFT",
    "PENDING",
    "COMPLETED",
    "CANCELLED",
  ]);

  const bills = await prisma.bill.findMany({
    where: {
      ...(createdAt && { createdAt }),
      ...(status.length > 0 && { status: { in: status as any } }),
      ...(query.vendorId && { vendorId: String(query.vendorId) }),
      ...(query.farmerId && { farmerId: String(query.farmerId) }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      farmer: {
        include: { banks: true },
      },
      vendor: true,
      advances: true,
      settlements: true,
      gonis: {
        include: { goniType: true },
      },
      deductions: true,
      payment: true,
    },
  });

  return bills.map((bill) => {
    const calculationDetails = buildBillingCalculationDetails(bill);
    const advanceAdjusted = (bill.advances || [])
      .filter((a) => a.txnType === "ADJUSTMENT")
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    const settledAmount = (bill.settlements || []).reduce(
      (sum, s) => sum + (s.amount || 0),
      0,
    );
    const afterLessAmount = Math.max(
      (bill.totalAmount || 0) - advanceAdjusted - settledAmount,
      0,
    );
    const labRows = (bill.deductions || []).filter((d) => {
      const payload = d.payload as any;
      return (
        payload &&
        typeof payload === "object" &&
        Array.isArray(payload.variableDetails) &&
        payload.variableDetails.length > 0
      );
    });
    const bank = bill.farmer?.banks?.[0];
    return {
      ...bill,
      bagCount: bill.gonis.reduce((sum, row) => sum + row.bagCount, 0),
      bagCountByType: bill.gonis
        .map((row) => `${row.goniType.name}: ${row.bagCount}`)
        .join(", "),
      goniType: {
        name: bill.gonis.map((row) => row.goniType.name).join(", "),
      },
      totalDeductionAmount: bill.deductions.reduce(
        (sum, d) => sum + (d.value || 0),
        0,
      ),
      deductionDetails: bill.deductions
        .map((d) => `${d.label}: ${d.value}`)
        .join(", "),
      labWeight: calculationDetails.netWeightForLab,
      labDeductionWeight: calculationDetails.totalLabDeductionWeight,
      netWeight: calculationDetails.finalNetPayableWeight,
      labDeductionAmount: calculationDetails.totalLabDeductionAmount,
      fixedDeductionAmount: calculationDetails.totalFixedDeductionAmount,
      labDeductionInputs: labRows
        .map((d) => {
          const variableDetails = (d.payload as any).variableDetails;
          return variableDetails
            .map((v: any) => `${v.label}: ${v.custom}`)
            .join(", ");
        })
        .join(" | "),
      labDeductionActuals: labRows
        .map((d) => {
          const variableDetails = (d.payload as any).variableDetails;
          return variableDetails
            .map((v: any) => `${v.label}: ${v.actual}`)
            .join(", ");
        })
        .join(" | "),
      advanceAdjusted,
      settledAmount,
      afterLessAmount,
      farmerBankName: bank?.bankName,
      farmerBankAccount: bank?.accountNo,
      farmerBankIfsc: bank?.ifsc,
      farmerBankHolder: bank?.holderName,
    };
  });
};

const getPaymentsReport = async (query: any) => {
  const status = parseStatusFilter(query.status);
  ensureAllowedStatus("payments", status, ["PENDING", "PAID", "FAILED"]);
  const createdAt = buildDateFilter(query.startDate, query.endDate);

  return prisma.farmerPayment.findMany({
    where: {
      ...(status.length > 0 && { status: { in: status as any } }),
      ...(query.farmerId && { farmerId: String(query.farmerId) }),
      ...(createdAt && { bill: { createdAt } }),
      ...(query.vendorId && { bill: { vendorId: String(query.vendorId) } }),
    },
    orderBy: { paidDate: "desc" },
    include: {
      farmer: true,
      bill: {
        include: {
          vendor: true,
        },
      },
    },
  });
};

const getStockTransfersReport = async (query: any) => {
  const createdAt = buildDateFilter(query.startDate, query.endDate);
  const status = parseStatusFilter(query.status);
  ensureAllowedStatus("stock-transfers", status, [
    "PENDING",
    "DISPATCHED",
    "RECEIVED",
    "DISCREPANCY",
    "COMPLETED",
    "CANCELLED",
  ]);

  return prisma.stockTransfer.findMany({
    where: {
      ...(createdAt && { createdAt }),
      ...(status.length > 0 && { status: { in: status as any } }),
      ...(query.vendorId && { vendorId: String(query.vendorId) }),
      ...(query.goniTypeId && { goniTypeId: String(query.goniTypeId) }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      vendor: true,
      toVendor: true,
      goniType: true,
      sourceLocation: true,
      destinationLocation: true,
    },
  });
};

const getStocksReport = async (query: any) => {
  const createdAt = buildDateFilter(query.startDate, query.endDate);
  const status = parseStatusFilter(query.status);
  ensureAllowedStatus("stocks", status, ["AVAILABLE", "TRANSFERRED"]);

  return prisma.stock.findMany({
    where: {
      ...(createdAt && { createdAt }),
      ...(status.length > 0 && { status: { in: status as any } }),
      ...(query.vendorId && { vendorId: String(query.vendorId) }),
      ...(query.goniTypeId && { goniTypeId: String(query.goniTypeId) }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      vendor: true,
      goniType: true,
      bill: true,
    },
  });
};

const getFarmersReport = async (query: any) => {
  const createdAt = buildDateFilter(query.startDate, query.endDate);

  return prisma.farmer.findMany({
    where: {
      ...(createdAt && { createdAt }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          lands: true,
          bills: true,
        },
      },
      bills: {
        orderBy: { billDate: "desc" },
        take: 1,
      },
    },
  });
};

const getVendorsReport = async (query: any) => {
  const createdAt = buildDateFilter(query.startDate, query.endDate);

  const vendors = await prisma.user.findMany({
    where: {
      role: "VENDOR",
      ...(createdAt && { createdAt }),
      ...(query.isActive !== undefined && {
        isActive: String(query.isActive) === "true",
      }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          bills: true,
          vendorFarmers: true,
        },
      },
    },
  });

  if (vendors.length === 0) return [];

  const vendorIds = vendors.map((v) => v.id);
  const payments = await prisma.farmerPayment.findMany({
    where: {
      bill: { vendorId: { in: vendorIds } },
    },
    select: {
      amount: true,
      status: true,
      bill: { select: { vendorId: true } },
    },
  });

  const totals = new Map<
    string,
    { paidAmount: number; pendingAmount: number; failedAmount: number }
  >();

  for (const p of payments) {
    const vendorId = p.bill.vendorId;
    const current = totals.get(vendorId) ?? {
      paidAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
    };

    if (p.status === "PAID") current.paidAmount += p.amount ?? 0;
    if (p.status === "PENDING") current.pendingAmount += p.amount ?? 0;
    if (p.status === "FAILED") current.failedAmount += p.amount ?? 0;

    totals.set(vendorId, current);
  }

  return vendors.map((v) => ({
    ...v,
    totalBills: v._count?.bills ?? 0,
    totalFarmers: v._count?.vendorFarmers ?? 0,
    ...(totals.get(v.id) ?? {
      paidAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
    }),
  }));
};

const getPurchaseLimitsReport = async () => {
  const limits = await prisma.purchaseLimit.findMany({
    orderBy: { createdAt: "desc" },
  });

  return limits.map((limit) => ({
    createdAt: limit.createdAt,
    value: limit.value,
    note: limit.note,
  }));
};

const reportHandlers: Record<ReportKey, (query: any) => Promise<any[]>> = {
  bills: getBillsReport,
  payments: getPaymentsReport,
  "stock-transfers": getStockTransfersReport,
  stocks: getStocksReport,
  farmers: getFarmersReport,
  vendors: getVendorsReport,
  "quality-rates": getQualityRatesReport,
  "purchase-limits": getPurchaseLimitsReport,
};

export const exportAdminReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reportType = req.params.reportType as ReportKey;
    const config = reportConfigs[reportType];

    if (!config || !reportHandlers[reportType]) {
      throw new AppError("Invalid report type", 400);
    }

    const data = await reportHandlers[reportType](req.query);
    const totalsRow = config.totalsRow ? config.totalsRow(data) : null;
    const rows = totalsRow ? [...data, totalsRow] : data;

    let columns: CsvColumn<any>[];
    if ("columnsFn" in config && config.columnsFn) {
      columns = config.columnsFn(rows);
    } else if ("columns" in config) {
      columns = config.columns;
    } else {
      throw new AppError("Invalid report type", 400);
    }

    const csv = toCsv(columns, rows);
    const filename = buildCsvFilename(config.filenamePrefix);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
