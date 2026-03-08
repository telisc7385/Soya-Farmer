import { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { successResponse } from "../../utils/response";
import { attachDeductionDetails } from "../../utils/deductionDetails";
import { buildBillingCalculationDetails } from "../../utils/billingCalculation";
import { roundTo } from "../../utils/number";

const withGoniAmount = (bill: any) => {
  const calculationDetails = buildBillingCalculationDetails(bill);
  const perQtlLabDeduction = roundTo(
    ((bill.ratePerUnit ?? 0) *
      (calculationDetails?.totalLabDeductionPercent ?? 0)) /
      100,
  );
  const totalAmount = Number(bill?.totalAmount ?? 0);
  const advancedAmount = Number(bill?.advancedAmount ?? 0);
  const balanceAmount = roundTo(Math.max(totalAmount - advancedAmount, 0));

  return {
    ...bill,
    totalAmount,
    advancedAmount,
    balanceAmount,
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
      startDate,
      endDate,
      status,
    } = req.query;

    const take = Number(limit);
    const currentPage = Number(page);
    const skip = (currentPage - 1) * take;

    const whereClause: any = {};

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

    // 🚀 Run queries in parallel (better performance)
    const [bills, total, averageRateResult] = await Promise.all([
      prisma.bill.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          farmer: {
            select: { name: true, phone: true },
          },
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
    const formattedBills = bills
      .map(attachDeductionDetails)
      .map(withGoniAmount);

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
      },
    });

    if (!bill) throw new AppError("Bill not found", 404);

    const billWithDetails = attachDeductionDetails(bill);
    const withGoni = withGoniAmount(billWithDetails);
    successResponse(res, withGoni, "Bill details");
  } catch (error) {
    next(error);
  }
};
