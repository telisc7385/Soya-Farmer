import { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { successResponse } from "../../utils/response";
import { attachDeductionDetails } from "../../utils/deductionDetails";
import { buildBillingCalculationDetails } from "../../utils/billingCalculation";
import { roundTo } from "../../utils/number";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
  getBillFinancialMap,
  getBillSettlementSummary,
} from "../../services/paymentManagement.service";

const paymentStatusSelect = {
  select: {
    id: true,
    amount: true,
    status: true,
    paidDate: true,
    reference: true,
  },
};

const withGoniAmount = (
  bill: any,
  financials?: {
    adjustedAdvanceAmount: number;
    settledAmount: number;
    pendingAmount: number;
  },
) => {
  const calculationDetails = buildBillingCalculationDetails(bill);
  const perQtlLabDeduction = roundTo(
    ((bill.ratePerUnit ?? 0) *
      (calculationDetails?.totalLabDeductionPercent ?? 0)) /
      100,
  );
  const totalAmount = Number(bill?.totalAmount ?? 0);
  const adjustedAdvanceAmount = Number(financials?.adjustedAdvanceAmount ?? 0);
  const settledAmount = Number(financials?.settledAmount ?? 0);
  const balanceAmount = roundTo(
    Number(
      financials?.pendingAmount ??
        Math.max(totalAmount - adjustedAdvanceAmount, 0),
    ),
  );
  const payment = bill.payment ?? null;
  const gonis = (bill.gonis ?? []).filter((row: any) => !row.goniType?.isLoose);
  const bagCount = gonis.reduce(
    (sum: number, row: any) => sum + (row.bagCount ?? 0),
    0,
  );

  return {
    ...bill,
    totalAmount,
    adjustedAdvanceAmount,
    settledAmount,
    balanceAmount,
    payment,
    paymentStatus: payment?.status ?? "PENDING",
    goniDeductionAmount: calculationDetails.goniDeductionAmount,
    calculationDetails,
    perQtlLabDeduction,
    rateAfterLabDeductionRounded:
      calculationDetails?.rateAfterLabDeductionRounded ?? 0,
    bagCount,
    bagTypes: gonis.map((row: any) => ({
      goniTypeId: row.goniTypeId,
      goniTypeName: row.goniType?.name ?? "",
      bagCount: row.bagCount,
      weight: row.weight,
    })),
  };
};

export const getBills = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      vendorId,
      purchaseCenter,
      paymentStatus,
      startDate,
      endDate,
      status,
    } = req.query;

    const take = Number(limit);
    const currentPage = Number(page);
    const skip = (currentPage - 1) * take;

    const whereClause: any = {};
    const andFilters: any[] = [];

    // 🔎 Search filter
    if (search && typeof search === "string") {
      whereClause.OR = [
        { farmer: { name: { contains: search, mode: "insensitive" } } },
        { farmer: { phone: { contains: search, mode: "insensitive" } } },
      ];
    }

    // 🏢 Vendor filter
    if (vendorId) {
      whereClause.vendorId = String(vendorId);
    }

    if (purchaseCenter && typeof purchaseCenter === "string") {
      whereClause.billLocation = {
        contains: purchaseCenter,
        mode: "insensitive",
      };
    }

    // 📅 Date filter
    if (startDate && endDate) {
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59.999");
      whereClause.createdAt = {
        gte: start,
        lte: end,
      };
    }

    if (typeof status === "string" && status.trim()) {
      const statusArray = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (statusArray.length) {
        whereClause.status = { in: statusArray };
      }
    }

    if (typeof paymentStatus === "string" && paymentStatus.trim()) {
      const paymentStatusArray = paymentStatus
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      if (paymentStatusArray.length) {
        if (paymentStatusArray.includes("PENDING")) {
          andFilters.push({
            OR: [
              { payment: { is: null } },
              { payment: { is: { status: { in: paymentStatusArray } } } },
            ],
          });
        } else {
          whereClause.payment = {
            is: { status: { in: paymentStatusArray } },
          };
        }
      }
    }

    if (andFilters.length) {
      whereClause.AND = andFilters;
    }

    // 🚀 Run queries in parallel (better performance)
    const [bills, total, averageRateResult] = await Promise.all([
      prisma.bill.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          farmer: {
            select: { id: true, name: true, phone: true },
          },
          vendor: {
            select: {
              id: true,
              name: true,
              phone: true,
              grnNumber: true,
              villageAdd: true,
            },
          },
          gonis: {
            include: {
              goniType: {
                select: { id: true, name: true, weightPerBag: true },
              },
            },
          },
          deductions: {
            include: {
              master: {
                include: {
                  variables: true,
                },
              },
            },
          },
          payment: paymentStatusSelect,
        },
      }),
      prisma.bill.count({ where: whereClause }),
      prisma.bill.aggregate({
        where: whereClause,
        _avg: {
          ratePerUnit: true,
        },
      }),
    ]);

    const averageRate = roundTo(
      Number(averageRateResult._avg.ratePerUnit ?? 0),
    );

    // 🔄 Transform data
    const billIds = bills.map((bill) => bill.id);
    const billFinancialsMap = await getBillFinancialMap(billIds);
    const formattedBills = bills
      .map(attachDeductionDetails)
      .map((bill) => withGoniAmount(bill, billFinancialsMap.get(bill.id)));

    // 📊 Average deduction per label across matched bills
    const deductionByLabel = new Map<string, { sum: number; count: number }>();
    for (const bill of bills) {
      for (const deduction of bill.deductions) {
        const current = deductionByLabel.get(deduction.label) ?? {
          sum: 0,
          count: 0,
        };
        current.sum += Number(deduction.value ?? 0);
        current.count += 1;
        deductionByLabel.set(deduction.label, current);
      }
    }
    const averageDeductions = Array.from(deductionByLabel.entries()).map(
      ([label, { sum, count }]) => ({
        label,
        count,
        average: roundTo(sum / count),
      }),
    );

    // 📊 Summary totals for analysis
    const summary = formattedBills.reduce(
      (acc, bill) => {
        const details = bill.calculationDetails ?? {};
        return {
          totalBills: acc.totalBills + 1,
          totalBags: acc.totalBags + (bill.bagCount ?? 0),
          totalBagWeight: acc.totalBagWeight + (bill.goniWeight ?? 0),
          totalGrossWeight: acc.totalGrossWeight + (bill.primaryQuantity ?? 0),
          totalLabWeight: acc.totalLabWeight + (details.netWeightForLab ?? 0),
          totalLabDeductionWeight:
            acc.totalLabDeductionWeight +
            (details.totalLabDeductionWeight ?? 0),
          totalNetWeight:
            acc.totalNetWeight + (details.finalNetPayableWeight ?? 0),
          totalGrossAmount:
            acc.totalGrossAmount + (bill.grossAmount ?? 0),
          totalLabDeductionAmount:
            acc.totalLabDeductionAmount +
            (details.totalLabDeductionAmount ?? 0),
          totalFixedDeductionAmount:
            acc.totalFixedDeductionAmount +
            (details.totalFixedDeductionAmount ?? 0),
          totalDeductionAmount:
            acc.totalDeductionAmount +
            (details.totalLabDeductionAmount ?? 0) +
            (details.totalFixedDeductionAmount ?? 0),
          totalNetPayable: acc.totalNetPayable + (bill.netPayable ?? 0),
          totalAmount: acc.totalAmount + (bill.totalAmount ?? 0),
        };
      },
      {
        totalBills: 0,
        totalBags: 0,
        totalBagWeight: 0,
        totalGrossWeight: 0,
        totalLabWeight: 0,
        totalLabDeductionWeight: 0,
        totalNetWeight: 0,
        totalGrossAmount: 0,
        totalLabDeductionAmount: 0,
        totalFixedDeductionAmount: 0,
        totalDeductionAmount: 0,
        totalNetPayable: 0,
        totalAmount: 0,
      },
    );

    for (const key of Object.keys(summary)) {
      if (key === "totalBills") continue;
      (summary as any)[key] = roundTo((summary as any)[key]);
    }

    successResponse(
      res,
      {
        bills: formattedBills,
        total,
        averageRate,
        averageDeductions,
        summary,
        page: currentPage,
        limit: take,
        pages: Math.ceil(total / take),
      },
      "Bills fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const getBillById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.billId },
      include: {
        farmer: {
          include: {
            banks: true,
          },
        },
        deductions: {
          include: {
            master: {
              include: {
                variables: true,
              },
            },
          },
        },
        gonis: {
          include: {
            goniType: true,
          },
        },
        advances: true,
        payment: paymentStatusSelect,
      },
    });

    if (!bill) throw new AppError("Bill not found", 404);

    const billWithDetails = attachDeductionDetails(bill);
    const summary = await getBillSettlementSummary(bill.id);
    const withGoni = withGoniAmount(billWithDetails, {
      adjustedAdvanceAmount: summary.adjustedAdvanceAmount,
      settledAmount: summary.settledAmount,
      pendingAmount: summary.pendingAmount,
    });
    successResponse(res, withGoni, "Bill details");
  } catch (error) {
    next(error);
  }
};

export const getVendorLastSixMonthsBillSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const bills = await prisma.bill.findMany({
      where: {
        vendorId,
        billDate: {
          gte: startMonth,
          lt: endMonth,
        },
        status: {
          in: ["PENDING", "COMPLETED"],
        },
      },
      select: {
        billDate: true,
        netPayable: true,
        primaryQuantity: true,
      },
    });

    const monthLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthKeys: string[] = [];
    const monthTotals = new Map<string, number>();
    const monthQuantities = new Map<string, number>();

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}`;
      monthKeys.push(key);
      monthTotals.set(key, 0);
      monthQuantities.set(key, 0);
    }

    for (const bill of bills) {
      const date = bill.billDate;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}`;
      if (!monthTotals.has(key)) continue;
      const current = monthTotals.get(key) ?? 0;
      monthTotals.set(key, roundTo(current + (bill.netPayable ?? 0)));
      const qtyCurrent = monthQuantities.get(key) ?? 0;
      monthQuantities.set(
        key,
        roundTo(qtyCurrent + (bill.primaryQuantity ?? 0)),
      );
    }

    const data = monthKeys.map((key) => {
      const [year, month] = key.split("-").map((value) => Number(value));
      const label = `${monthLabels[month - 1]} ${year}`;
      return {
        month: label,
        amount: monthTotals.get(key) ?? 0,
        quantity: monthQuantities.get(key) ?? 0,
      };
    });

    successResponse(
      res,
      {
        startDate: startMonth.toISOString(),
        endDate: new Date(endMonth.getTime() - 1).toISOString(),
        data,
      },
      "Vendor last six months bill summary",
    );
  } catch (error) {
    next(error);
  }
};
