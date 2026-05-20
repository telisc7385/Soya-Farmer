import { NextFunction, Request, Response } from "express";
import { AdvanceReason, AdvanceSource } from "@prisma/client";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { successResponse } from "../utils/response";
import {
  createBillSettlement,
  createProfileAdvance,
  getBillSettlementSummary,
  getFarmerAdvanceBalance,
} from "../services/paymentManagement.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const payFarmer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { amount, paidDate, reference, remarks } = req.body;
    const actorId = req.user?.id;
    if (!actorId) throw new AppError("Unauthorized", 401);

    const settlement = await createBillSettlement({
      billId,
      amount,
      paidDate,
      reference,
      remarks,
      createdById: actorId,
    });

    successResponse(
      res,
      {
        totalAmount: settlement.totalAmount,
        adjustedAdvanceAmount: settlement.adjustedAdvanceAmount,
        settledAmount: settlement.settledAmount,
        remainingAmount: settlement.pendingAmount,
        settlement: settlement.createdSettlement,
      },
      settlement.isFullyPaid
        ? "Farmer payment completed successfully"
        : "Against payment recorded successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const rejectBill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { reason } = req.body;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) throw new AppError("Bill not found", 404);
    if (bill.status !== "PENDING")
      throw new AppError("Only pending bills can be rejected", 400);

    await prisma.bill.update({
      where: { id: billId },
      data: {
        status: "CANCELLED",
      },
    });

    // Keep this console log for current operations until rejection reason persistence is added.
    console.log("Bill rejected:", reason);

    successResponse(res, null, "Bill rejected successfully");
  } catch (error) {
    next(error);
  }
};

export const createFarmerAdvance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const { amount, reason, remarks, source, billId } = req.body;
    const actorId = req.user?.id;
    if (!actorId) throw new AppError("Unauthorized", 401);

    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) throw new AppError("Farmer not found", 404);

    const advance = await createProfileAdvance({
      farmerId,
      amount,
      reason: reason as AdvanceReason,
      remarks,
      source: source as AdvanceSource,
      billId,
      createdById: actorId,
    });

    const balance = await getFarmerAdvanceBalance(farmerId);
    successResponse(
      res,
      {
        advance,
        balance,
      },
      "Advance recorded successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const getFarmerAdvances = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const advances = await prisma.farmerAdvance.findMany({
      where: { farmerId },
      orderBy: { createdAt: "desc" },
      include: {
        bill: {
          select: {
            id: true,
            billNo: true,
          },
        },
      },
    });
    successResponse(res, advances, "Advance history fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const getFarmerAdvanceBalanceController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const balance = await getFarmerAdvanceBalance(farmerId);
    successResponse(res, { farmerId, balance }, "Advance balance fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const createAgainstSettlement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { amount, paidDate, reference, remarks } = req.body;
    const actorId = req.user?.id;
    if (!actorId) throw new AppError("Unauthorized", 401);

    const settlement = await createBillSettlement({
      billId,
      amount,
      paidDate,
      reference,
      remarks,
      createdById: actorId,
    });

    successResponse(
      res,
      {
        settlement: settlement.createdSettlement,
        totalAmount: settlement.totalAmount,
        adjustedAdvanceAmount: settlement.adjustedAdvanceAmount,
        settledAmount: settlement.settledAmount,
        pendingAmount: settlement.pendingAmount,
      },
      "Bill settlement recorded successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const getBillSettlements = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const settlements = await prisma.billSettlement.findMany({
      where: { billId },
      orderBy: { createdAt: "desc" },
    });
    const summary = await getBillSettlementSummary(billId);
    successResponse(
      res,
      {
        settlements,
        totalAmount: summary.baseAmount,
        adjustedAdvanceAmount: summary.adjustedAdvanceAmount,
        settledAmount: summary.settledAmount,
        pendingAmount: summary.pendingAmount,
      },
      "Bill settlements fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = "1",
      limit = "10",
      search,
      farmerId,
      // startDate,
      // endDate,
    } = req.query;

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {
      ...(farmerId && { farmerId: String(farmerId) }),

      ...(search && {
        farmer: {
          OR: [
            {
              name: {
                contains: String(search),
                mode: "insensitive",
              },
            },
            {
              aadhaarNo: {
                contains: String(search),
                mode: "insensitive",
              },
            },
          ],
        },
      }),

      // ...((startDate || endDate) && {
      //   createdAt: {
      //     ...(startDate && { gte: new Date(String(startDate)) }),
      //     ...(endDate && { lte: new Date(String(endDate)) }),
      //   },
      // }),
    };

    const [total, payments] = await Promise.all([
      prisma.farmerPayment.count({ where }),
      prisma.farmerPayment.findMany({
        where,
        skip,
        take,
        // orderBy: { createdAt: "desc" },
        include: {
          farmer: {
            select: { name: true, phone: true, aadhaarNo: true },
          },
          bill: true,
        },
      }),
    ]);

    successResponse(
      res,
      {
        payments,
        total,
        page: Number(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
      "Completed payments retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};
