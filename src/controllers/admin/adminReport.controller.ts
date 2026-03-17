import { Request, Response, NextFunction } from "express";
import { reportConfigs, ReportKey } from "../../utils/reportConfigs";
import { AppError } from "../../core/appError";
import prisma from "../../database/prisma";
import { buildCsvFilename, toCsv } from "../../utils/csv";

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
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  return filter;
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
      farmer: true,
      vendor: true,
      gonis: {
        include: { goniType: true },
      },
      payment: true,
    },
  });

  return bills.map((bill) => ({
    ...bill,
    bagCount: bill.gonis.reduce((sum, row) => sum + row.bagCount, 0),
    goniType: {
      name: bill.gonis.map((row) => row.goniType.name).join(", "),
    },
  }));
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
      goniType: true,
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

const reportHandlers: Record<ReportKey, (query: any) => Promise<any[]>> = {
  bills: getBillsReport,
  payments: getPaymentsReport,
  "stock-transfers": getStockTransfersReport,
  stocks: getStocksReport,
  farmers: getFarmersReport,
  vendors: getVendorsReport,
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
    const csv = toCsv(config.columns, rows);
    const filename = buildCsvFilename(config.filenamePrefix);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
