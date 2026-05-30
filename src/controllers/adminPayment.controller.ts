import { NextFunction, Request, Response } from "express";
import { AdvanceReason, AdvanceSource } from "@prisma/client";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { successResponse } from "../utils/response";
import {
  createBillSettlement,
  createProfileAdvance,
  getBillFinancialMap,
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

export const bulkUpdatePaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billIds, status, remarks } = req.body;
    const actorId = req.user?.id;
    if (!actorId) throw new AppError("Unauthorized", 401);

    if (!Array.isArray(billIds) || billIds.length === 0) {
      throw new AppError("billIds must be a non-empty array", 400);
    }

    const bills = await prisma.bill.findMany({
      where: { id: { in: billIds } },
      select: { id: true, farmerId: true, status: true },
    });

    const foundIds = new Set(bills.map((b) => b.id));
    const notFound = billIds.filter((id: string) => !foundIds.has(id));
    if (notFound.length > 0) {
      throw new AppError(`Bills not found: ${notFound.join(", ")}`, 404);
    }

    const billFinancialsMap = await getBillFinancialMap(bills.map((bill) => bill.id));

    const results = await prisma.$transaction(async (tx) => {
      const updated: { billId: string; farmerId: string; oldStatus: string | null; newStatus: string; amount: number; pendingAmount: number; createdPaymentRecord: boolean }[] = [];
      const skipped: { billId: string; reason: string }[] = [];

      for (const bill of bills) {
        if (bill.status === "DRAFT" || bill.status === "CANCELLED") {
          skipped.push({
            billId: bill.id,
            reason: `Bill status is ${bill.status}`,
          });
          continue;
        }

        const financials = billFinancialsMap.get(bill.id);
        const pendingAmount = financials?.pendingAmount ?? 0;
        const paymentAmount =
          status === "PAID"
            ? (financials?.adjustedAdvanceAmount ?? 0) +
              (financials?.settledAmount ?? 0) +
              pendingAmount
            : pendingAmount;
        const existingPayment = await tx.farmerPayment.findUnique({
          where: { billId: bill.id },
        });

        const oldStatus = existingPayment?.status ?? null;
        const paidDate = status === "PAID" ? new Date() : null;

        if (status === "PAID" && pendingAmount > 0) {
          await tx.billSettlement.create({
            data: {
              billId: bill.id,
              farmerId: bill.farmerId,
              amount: pendingAmount,
              paidDate,
              remarks: remarks ?? "Bulk payment status update",
              createdById: actorId,
            },
          });
        }

        if (existingPayment) {
          await tx.farmerPayment.update({
            where: { billId: bill.id },
            data: {
              amount: paymentAmount,
              status,
              paidDate:
                paidDate
                  ? existingPayment.paidDate ?? paidDate
                  : existingPayment.paidDate,
            },
          });
        } else {
          await tx.farmerPayment.create({
            data: {
              billId: bill.id,
              farmerId: bill.farmerId,
              amount: paymentAmount,
              status,
              paidDate,
            },
          });
        }

        if (status === "PAID") {
          await tx.bill.update({
            where: { id: bill.id },
            data: { status: "COMPLETED" },
          });
        }

        await tx.paymentActivity.create({
          data: {
            billId: bill.id,
            farmerId: bill.farmerId,
            oldStatus,
            newStatus: status,
            remarks: remarks ?? null,
            createdById: actorId,
          },
        });

        updated.push({
          billId: bill.id,
          farmerId: bill.farmerId,
          oldStatus,
          newStatus: status,
          amount: paymentAmount,
          pendingAmount,
          createdPaymentRecord: !existingPayment,
        });
      }

      return { updated, skipped };
    });

    successResponse(
      res,
      {
        updated: results.updated,
        skipped: results.skipped,
        totalUpdated: results.updated.length,
        totalSkipped: results.skipped.length,
      },
      `Payment status updated to "${status}" for ${results.updated.length} bill(s)${results.skipped.length > 0 ? `, ${results.skipped.length} skipped` : ""}`,
    );
  } catch (error) {
    next(error);
  }
};

export const getPaymentActivities = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const activities = await prisma.paymentActivity.findMany({
      where: { billId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    successResponse(res, activities, "Payment activities fetched successfully");
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
      vendorId,
      status,
      startDate,
      endDate,
    } = req.query;

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {
      ...(farmerId && { farmerId: String(farmerId) }),
      ...(status && { status: String(status).toUpperCase() }),

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

      ...(vendorId && {
        bill: { vendorId: String(vendorId) },
      }),

      ...((startDate || endDate) && {
        paidDate: {
          ...(startDate && { gte: new Date(String(startDate)) }),
          ...(endDate && { lte: new Date(String(endDate)) }),
        },
      }),
    };

    const [total, payments] = await Promise.all([
      prisma.farmerPayment.count({ where }),
      prisma.farmerPayment.findMany({
        where,
        skip,
        take,
        orderBy: { bill: { billDate: "desc" } },
        include: {
          farmer: {
            select: { name: true, phone: true, aadhaarNo: true },
          },
          bill: {
            include: {
              vendor: {
                select: { id: true, name: true },
              },
            },
          },
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
      "Payments retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};
