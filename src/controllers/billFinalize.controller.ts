import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { successResponse } from "../utils/response";

export const finalizeBill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        items: true,
        weight: true,
      },
    });

    if (!bill) throw new AppError("Bill not found", 404);
    if (bill.status !== "DRAFT")
      throw new AppError("Bill already finalized", 400);

    if (!bill.items.length) throw new AppError("Bill has no items", 400);

    if (!bill.weight) throw new AppError("Weigh slip not added", 400);

    if (bill.totalAmount <= 0) throw new AppError("Invalid bill amount", 400);

    await prisma.bill.update({
      where: { id: billId },
      data: {
        status: "PENDING",
      },
    });

    successResponse(res, null, "Bill finalized successfully");
  } catch (error) {
    next(error);
  }
};
