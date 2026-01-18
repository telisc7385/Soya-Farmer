import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { generateBillNo } from "../utils/billNo";
import { AuthRequest } from "../middleware/auth.middleware";
import { checkFarmer } from "../repositories/checkFarmer.repository";

/**
 * Create Bill (DRAFT)
 */
export const createBill = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { farmerId, millId, vehicleId, billDate } = req.body;

    await checkFarmer(farmerId);

    const billNo = await generateBillNo();

    const bill = await prisma.bill.create({
      data: {
        billNo,
        billDate: new Date(billDate),
        vendorId,
        farmerId,
        millId,
        vehicleId,
        status: "DRAFT",
        totalAmount: 0,
      },
    });

    createdResponse(res, bill, "Bill created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Add Bill Item + Stock OUT
 */
export const addBillItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { productId, quantity, unit, rate, bagCount } = req.body;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) throw new AppError("Bill not found", 404);
    if (bill.status !== "DRAFT")
      throw new AppError("Bill already finalized", 400);

    const amount = quantity * rate;

    await prisma.$transaction(async (tx) => {
      // Add bill item
      await tx.billItem.create({
        data: {
          billId,
          productId,
          quantity,
          unit,
          rate,
          amount,
          bagCount,
        },
      });

      // Update bill total
      await tx.bill.update({
        where: { id: billId },
        data: {
          totalAmount: { increment: amount },
        },
      });

      // Reduce stock
      const stock = await tx.stock.findFirst({
        where: {
          vendorId: bill.vendorId,
          farmerId: bill.farmerId,
          productId,
        },
      });

      if (!stock || stock.quantity < quantity) {
        throw new AppError("Insufficient stock", 400);
      }

      await tx.stock.update({
        where: { id: stock.id },
        data: {
          quantity: { decrement: quantity },
        },
      });

      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: "OUT",
          quantity,
          reference: billId,
        },
      });
    });

    successResponse(res, null, "Item added to bill");
  } catch (error) {
    next(error);
  }
};

/**
 * Get all bills
 */
export const getBills = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bills = await prisma.bill.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        farmer: true,
        items: true,
      },
    });

    successResponse(res, bills, "Bills fetched");
  } catch (error) {
    next(error);
  }
};

/**
 * Get bill by ID
 */
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
        items: true,
        deductions: true,
        slips: true,
      },
    });

    if (!bill) throw new AppError("Bill not found", 404);

    successResponse(res, bill, "Bill details");
  } catch (error) {
    next(error);
  }
};
