import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";

/**
 * Add Weigh Slip with Entries
 */
export const addWeighSlip = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;
    const { slipNo, entries } = req.body;

    console.log(billId, "billId");

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { weight: true },
    });

    if (!bill) throw new AppError("Bill not found", 404);
    if (bill.status !== "DRAFT")
      throw new AppError("Bill already finalized", 400);

    let totalGross = 0;
    let totalTare = 0;
    let totalNet = 0;

    entries.forEach((e: any) => {
      const net = e.gross - e.tare;
      totalGross += e.gross;
      totalTare += e.tare;
      totalNet += net;
    });

    await prisma.$transaction(async (tx) => {
      // Create slip
      const slip = await tx.weighSlip.create({
        data: {
          billId,
          slipNo,
        },
      });

      // Create entries
      for (const entry of entries) {
        await tx.weighSlipEntry.create({
          data: {
            slipId: slip.id,
            srNo: entry.srNo,
            gross: entry.gross,
            tare: entry.tare,
            net: entry.gross - entry.tare,
          },
        });
      }

      // Upsert bill weight summary
      if (bill.weight) {
        await tx.billWeight.update({
          where: { billId },
          data: {
            gross: { increment: totalGross },
            tare: { increment: totalTare },
            net: { increment: totalNet },
          },
        });
      } else {
        await tx.billWeight.create({
          data: {
            billId,
            gross: totalGross,
            tare: totalTare,
            net: totalNet,
          },
        });
      }
    });

    createdResponse(res, null, "Weigh slip added successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get weigh slips by bill
 */
export const getWeighSlips = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { billId } = req.params;

    const slips = await prisma.weighSlip.findMany({
      where: { billId },
      include: {
        entries: true,
      },
      orderBy: { createdAt: "desc" },
    });

    successResponse(res, slips, "Weigh slips fetched");
  } catch (error) {
    next(error);
  }
};
