import { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { successResponse } from "../../utils/response";
import { attachDeductionDetails } from "../../utils/deductionDetails";
import { buildBillingCalculationDetails } from "../../utils/billingCalculation";
import { roundTo } from "../../utils/number";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getBillFinancialMap, getBillSettlementSummary } from "../../services/paymentManagement.service";

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
  financials?: { adjustedAdvanceAmount: number; settledAmount: number; pendingAmount: number },
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
    Number(financials?.pendingAmount ?? Math.max(totalAmount - adjustedAdvanceAmount, 0)),
  );
  const payment = bill.payment ?? null;

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
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
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

    successResponse(
      res,
      {
        bills: formattedBills,
        total,
        averageRate,
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
        farmer: true,
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
