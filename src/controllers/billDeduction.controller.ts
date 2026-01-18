import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";

/**
 * Add Deduction to Bill
 */
export const addBillDeductions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { deductions } = req.body;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) throw new AppError("Bill not found", 404);
    if (bill.status !== "DRAFT")
      throw new AppError("Bill already finalized", 400);

    const totalDeduction = deductions.reduce(
      (sum: number, d: any) => sum + d.value,
      0,
    );

    await prisma.$transaction(async (tx) => {
      await tx.billDeduction.createMany({
        data: deductions.map((d: any) => ({
          billId,
          label: d.label,
          value: d.value,
        })),
      });

      await tx.bill.update({
        where: { id: billId },
        data: {
          totalAmount: { decrement: totalDeduction },
        },
      });
    });

    createdResponse(res, null, "Deductions added successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get Bill Deductions
 */
export const getBillDeductions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const deductions = await prisma.billDeduction.findMany({
      where: { billId: req.params.billId },
    });

    successResponse(res, deductions, "Deductions fetched");
  } catch (error) {
    next(error);
  }
};
