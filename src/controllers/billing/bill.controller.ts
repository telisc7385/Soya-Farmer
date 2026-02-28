import { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { successResponse } from "../../utils/response";
import { attachDeductionDetails } from "../../utils/deductionDetails";
import { roundTo } from "../../utils/number";

const withGoniAmount = (bill: any) => {
  const goniWeight = bill?.goniWeight ?? 0;
  const ratePerUnit = bill?.ratePerUnit ?? 0;
  const goniDeductionAmount = roundTo(goniWeight * ratePerUnit);
  return { ...bill, goniDeductionAmount };
};

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
        deductions: true,
        goniType: true,
      },
    });

    const withGoni = bills.map(withGoniAmount);
    successResponse(res, withGoni, "Bills fetched");
  } catch (error) {
    next(error);
  }
};

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
        deductions: {
          include: {
            master: {
              include: {
                variables: true,
              },
            },
          },
        },
        goniType: true,
      },
    });

    if (!bill) throw new AppError("Bill not found", 404);

    const billWithDetails = attachDeductionDetails(bill);
    const withGoni = withGoniAmount(billWithDetails);
    successResponse(res, withGoni, "Bill details");
  } catch (error) {
    next(error);
  }
};
