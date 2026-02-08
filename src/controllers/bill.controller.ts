import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { generateBillNo } from "../utils/billNo";
import { AuthRequest } from "../middleware/auth.middleware";
import { checkFarmer } from "../repositories/checkFarmer.repository";

/**
 * Create/Update Bill with Items, Deductions, Weigh Slips (DRAFT)
 */
export const saveBill = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const {
      billId,
      farmerId,
      billDate,
      items = [],
      deductions = [],
      slips = [],
    } = req.body;

    let existingBill = null as null | { id: string; vendorId: string; farmerId: string; billDate: Date; status: string };

    if (billId) {
      existingBill = await prisma.bill.findUnique({
        where: { id: billId },
      });
      if (!existingBill) throw new AppError("Bill not found", 404);
      if (existingBill.vendorId !== vendorId)
        throw new AppError("Unauthorized", 403);
      if (existingBill.status !== "DRAFT")
        throw new AppError("Bill already finalized", 400);
    }

    if (!billId) {
      if (!farmerId || !billDate) {
        throw new AppError("Missing required bill fields", 400);
      }
      await checkFarmer(farmerId);
    } else if (farmerId) {
      await checkFarmer(farmerId);
    }

    const computedItems: any[] = [];
    let totalItems = 0;
    for (const i of items || []) {
      const amount = i.quantity * i.rate;
      computedItems.push({
        productId: i.productId,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        bagCount: i.bagCount,
        amount,
      });
      totalItems += amount;
    }

    let totalDeductions = 0;
    const computedDeductions: any[] = [];
    for (const d of deductions || []) {
      computedDeductions.push({ label: d.label, value: d.value });
      totalDeductions += d.value;
    }

    let totalGross = 0;
    let totalTare = 0;
    let totalNet = 0;
    const computedSlips = (slips || []).map((s: any) => {
      const entries = (s.entries || []).map((e: any) => {
        const net = e.gross - e.tare;
        totalGross += e.gross;
        totalTare += e.tare;
        totalNet += net;
        return {
          srNo: e.srNo,
          gross: e.gross,
          tare: e.tare,
          net,
        };
      });
      return { slipNo: s.slipNo, entries };
    });

    const result = await prisma.$transaction(async (tx) => {
      let bill = existingBill as any;

      if (billId) {
        await Promise.all([
          tx.weighSlipEntry.deleteMany({ where: { slip: { billId } } }),
          tx.weighSlip.deleteMany({ where: { billId } }),
          tx.billWeight.deleteMany({ where: { billId } }),
          tx.billItem.deleteMany({ where: { billId } }),
          tx.billDeduction.deleteMany({ where: { billId } }),
        ]);

        bill = await tx.bill.update({
          where: { id: billId },
          data: {
            farmerId: farmerId ?? existingBill!.farmerId,
            billDate: billDate ? new Date(billDate) : existingBill!.billDate,
          },
        });
      } else {
        const billNo = await generateBillNo();
        bill = await tx.bill.create({
          data: {
            billNo,
            billDate: new Date(billDate),
            vendorId,
            farmerId,
            status: "DRAFT",
            totalAmount: 0,
          },
        });
      }

      if (computedItems.length) {
        await tx.billItem.createMany({
          data: computedItems.map((i: any) => ({
            billId: bill.id,
            productId: i.productId,
            quantity: i.quantity,
            unit: i.unit,
            rate: i.rate,
            amount: i.amount,
            bagCount: i.bagCount,
          })),
        });
      }

      if (computedDeductions.length) {
        await tx.billDeduction.createMany({
          data: computedDeductions.map((d: any) => ({
            billId: bill.id,
            label: d.label,
            value: d.value,
          })),
        });
      }

      if (computedSlips.length) {
        await Promise.all(
          computedSlips.map(async (slip: any) => {
            const createdSlip = await tx.weighSlip.create({
              data: {
                billId: bill.id,
                slipNo: slip.slipNo,
              },
            });

            if (slip.entries.length) {
              await tx.weighSlipEntry.createMany({
                data: slip.entries.map((e: any) => ({
                  slipId: createdSlip.id,
                  srNo: e.srNo,
                  gross: e.gross,
                  tare: e.tare,
                  net: e.net,
                })),
              });
            }
          }),
        );

        await tx.billWeight.create({
          data: {
            billId: bill.id,
            gross: totalGross,
            tare: totalTare,
            net: totalNet,
          },
        });
      }

      const totalAmount = totalItems - totalDeductions;
      await tx.bill.update({
        where: { id: bill.id },
        data: { totalAmount },
      });

      return bill;
    });

    if (billId) {
      successResponse(res, result, "Bill updated successfully");
    } else {
      createdResponse(res, result, "Bill created successfully");
    }
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
