import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { successResponse } from "../utils/response";

export const payFarmer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { amount, paidDate, reference } = req.body;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { payment: true },
    });

    if (!bill) throw new AppError("Bill not found", 404);
    if (bill.status !== "PENDING")
      throw new AppError("Bill not ready for payment", 400);
    if (typeof amount !== "number" || amount <= 0) {
      throw new AppError("Payment amount must be greater than 0", 400);
    }

    const totalAmount = Number(bill.totalAmount ?? 0);
    const advancedAmount = Number((bill as any).advancedAmount ?? 0);
    const remainingAmount = Number((totalAmount - advancedAmount).toFixed(2));

    if (amount > remainingAmount) {
      throw new AppError(
        `Payment amount cannot exceed remaining amount (${remainingAmount})`,
        400,
      );
    }

    const updatedAdvancedAmount = Number((advancedAmount + amount).toFixed(2));
    const isFullyPaid = updatedAdvancedAmount >= totalAmount;

    await prisma.$transaction(async (tx) => {
      if (bill.payment) {
        await tx.farmerPayment.update({
          where: { billId },
          data: {
            amount: updatedAdvancedAmount,
            status: isFullyPaid ? "PAID" : "PENDING",
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            reference,
          },
        });
      } else {
        await tx.farmerPayment.create({
          data: {
            billId,
            farmerId: bill.farmerId,
            amount: updatedAdvancedAmount,
            status: isFullyPaid ? "PAID" : "PENDING",
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            reference,
          },
        });
      }

      await tx.bill.update({
        where: { id: billId },
        data: {
          advancedAmount: updatedAdvancedAmount,
          status: isFullyPaid ? "COMPLETED" : "PENDING",
        },
      });
    });

    successResponse(
      res,
      {
        totalAmount,
        advancedAmount: updatedAdvancedAmount,
        remainingAmount: Number(
          Math.max(totalAmount - updatedAdvancedAmount, 0).toFixed(2),
        ),
      },
      isFullyPaid
        ? "Farmer payment completed successfully"
        : "Advance payment recorded successfully",
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

    // Optional: log reason (recommended)
    console.log("Bill rejected:", reason);

    successResponse(res, null, "Bill rejected successfully");
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
