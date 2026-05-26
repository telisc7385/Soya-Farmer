import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { Response, NextFunction, Request } from "express";
import { createBankDetailsSchema } from "../validations/bankDetails.validation";

const checkDuplicateIfsc = async (ifsc: string, excludeId?: string) => {
  const existing = await prisma.bankDetails.findFirst({
    where: {
      ifsc: { equals: ifsc, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return !!existing;
};

const parseCsvBuffer = (buffer: Buffer) => {
  const raw = buffer.toString("utf-8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new AppError("CSV must have a header row and at least one data row", 400);
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const bankNameIdx = header.indexOf("bankname");
  const ifscIdx = header.indexOf("ifsc");

  if (bankNameIdx === -1 || ifscIdx === -1) {
    throw new AppError('CSV must contain "bankName" and "ifsc" columns', 400);
  }

  const seen = new Set<string>();
  const result: { bankName: string; ifsc: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const bankName = cols[bankNameIdx];
    const ifsc = cols[ifscIdx];
    if (!bankName || !ifsc) continue;

    const key = ifsc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ bankName, ifsc });
  }

  return result;
};

// Bank Details APIs
export const createBankDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
  const { bankName, branchName, ifsc } = req.body;

    await createBankDetailsSchema.validateAsync({ bankName, branchName, ifsc });

    const isDuplicate = await checkDuplicateIfsc(ifsc);
    if (isDuplicate) {
      throw new AppError(`IFSC "${ifsc}" already exists`, 409);
    }

    const bank = await prisma.bankDetails.create({
      data: { bankName, branchName, ifsc },
    });
    createdResponse(res, bank, "Bank details created");
  } catch (error) {
    next(error);
  }
};

export const createBankDetailsViaCsv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      throw new AppError("CSV file is required", 400);
    }

    const rows = parseCsvBuffer(req.file.buffer);

    if (rows.length === 0) {
      throw new AppError("No valid bank records found in CSV", 400);
    }

    const existingRecords = await prisma.bankDetails.findMany({
      where: {
        OR: rows.map((r) => ({
          ifsc: { equals: r.ifsc, mode: "insensitive" },
        })),
      },
      select: { ifsc: true },
    });

    const existingSet = new Set(
      existingRecords.map((r) => r.ifsc.toLowerCase()),
    );

    const valid: { bankName: string; ifsc: string }[] = [];
    const failed: { bankName: string; ifsc: string; reason: string }[] = [];

    for (const row of rows) {
      const key = row.ifsc.toLowerCase();
      if (existingSet.has(key)) {
        failed.push({
          bankName: row.bankName,
          ifsc: row.ifsc,
          reason: `IFSC "${row.ifsc}" already exists`,
        });
      } else {
        valid.push(row);
        existingSet.add(key);
      }
    }

    let created: any[] = [];
    if (valid.length > 0) {
      await prisma.bankDetails.createMany({ data: valid });
      created = await prisma.bankDetails.findMany({
        where: {
          OR: valid.map((r) => ({ bankName: r.bankName, ifsc: r.ifsc })),
        },
      });
    }

    successResponse(
      res,
      { created, failed, totalCreated: created.length, totalFailed: failed.length },
      `Bank details processed: ${created.length} created, ${failed.length} failed`,
    );
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
    const { bankName, branchName, ifsc } = req.body;
    const { bankId } = req.params;

    const isDuplicate = await checkDuplicateIfsc(ifsc, bankId);
    if (isDuplicate) {
      throw new AppError(`IFSC "${ifsc}" already exists`, 409);
    }

    const bank = await prisma.bankDetails.update({
      where: { id: bankId },
      data: { bankName, branchName, ifsc },
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
