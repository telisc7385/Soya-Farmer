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

    if (bill.payment) throw new AppError("Payment already done", 400);

    await prisma.$transaction(async (tx) => {
      await tx.farmerPayment.create({
        data: {
          billId,
          farmerId: bill.farmerId,
          amount,
          status: "PAID",
          paidDate: paidDate ? new Date(paidDate) : new Date(),
          reference,
        },
      });

      await tx.bill.update({
        where: { id: billId },
        data: {
          status: "COMPLETED",
        },
      });
    });

    successResponse(res, null, "Farmer paid successfully");
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
