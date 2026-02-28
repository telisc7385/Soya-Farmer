import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { Response, NextFunction, Request } from "express";

// Bank Details APIs
export const createBankDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { bankName } = req.body;

    const bank = await prisma.bankDetails.create({
      data: {
        bankName,
      },
    });
    createdResponse(res, bank, "Bank details created");
  } catch (error) {
    next(error);
  }
};
export const updateBankDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { bankName } = req.body;
    const { bankId } = req.params;

    const bank = await prisma.bankDetails.update({
      where: { id: bankId },
      data: {
        bankName,
      },
    });
    if (!bank) {
      throw new AppError("Bank details not found", 404);
    }
    successResponse(res, bank, "Bank details updated");
  } catch (error) {
    next(error);
  }
};
export const deleteBankDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { bankId } = req.params;

    const deletedBank = await prisma.bankDetails.delete({
      where: { id: bankId },
    });

    if (!deletedBank) {
      throw new AppError("Bank details not found", 404);
    }

    successResponse(res, undefined, "Bank details deleted");
  } catch (error) {
    next(error);
  }
};
export const getAllBankDetails = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const banks = await prisma.bankDetails.findMany();
    successResponse(res, banks, "All bank details fetched");
  } catch (error) {
    next(error);
  }
};
