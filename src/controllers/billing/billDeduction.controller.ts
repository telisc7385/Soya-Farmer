import { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { createdResponse, successResponse } from "../../utils/response";

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

// Update Deduction
export const updateBillDeduction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { deductionId } = req.params;
    const { label, value } = req.body;

    const deduction = await prisma.billDeduction.findUnique({
      where: { id: deductionId },
      include: { bill: true },
    });

    if (!deduction) throw new AppError("Deduction not found", 404);
    if (deduction.bill.status !== "DRAFT")
      throw new AppError("Bill already finalized", 400);

    const diff = value - deduction.value;

    await prisma.$transaction(async (tx) => {
      await tx.billDeduction.update({
        where: { id: deductionId },
        data: { label, value },
      });

      await tx.bill.update({
        where: { id: deduction.billId },
        data: {
          totalAmount: { decrement: diff },
        },
      });
    });

    successResponse(res, null, "Deduction updated");
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

export const deleteBillDeduction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { deductionId } = req.params;

    const deduction = await prisma.billDeduction.findUnique({
      where: { id: deductionId },
      include: { bill: true },
    });

    if (!deduction) throw new AppError("Deduction not found", 404);
    if (deduction.bill.status !== "DRAFT")
      throw new AppError("Bill already finalized", 400);

    await prisma.$transaction(async (tx) => {
      await tx.billDeduction.delete({ where: { id: deductionId } });

      await tx.bill.update({
        where: { id: deduction.billId },
        data: {
          totalAmount: { increment: deduction.value },
        },
      });
    });

    successResponse(res, null, "Deduction deleted");
  } catch (error) {
    next(error);
  }
};
