import { NextFunction, Response } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { AuthRequest } from "../middleware/auth.middleware";
import { successResponse } from "../utils/response";

export const saveQualityRate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);

    const { quality, rate, isActive } = req.body;
    const userId = req.user.id;

    const qualityRate = await prisma.qualityRate.create({
      data: {
        quality,
        rate,
        isActive: isActive ?? true,
        createdBy: userId,
      },
    });

    successResponse(res, qualityRate, "Quality rate saved");
  } catch (error) {
    next(error);
  }
};

export const listAllQualityRates = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const qualityRates = await prisma.qualityRate.findMany({
      orderBy: { createdAt: "asc" },
    });

    successResponse(res, qualityRates, "Quality rates fetched");
  } catch (error) {
    next(error);
  }
};

export const changeQualityRateStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { qualityId } = req.params;

    const existingQualityRate = await prisma.qualityRate.findUnique({
      where: { id: qualityId },
    });

    if (!existingQualityRate) {
      throw new AppError("Quality rate not found", 404);
    }

    const updatedQualityRate = await prisma.$transaction(async (tx) => {
      // If we are activating this record, deactivate others
      if (!existingQualityRate.isActive) {
        await tx.qualityRate.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      return tx.qualityRate.update({
        where: { id: qualityId },
        data: { isActive: !existingQualityRate.isActive },
      });
    });

    successResponse(
      res,
      updatedQualityRate,
      "Quality rate status changed successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const deleteQualityRate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { qualityId } = req.params;

    // Check if record exists
    const existingQualityRate = await prisma.qualityRate.findUnique({
      where: { id: qualityId },
    });

    if (!existingQualityRate) {
      throw new AppError("Quality rate not found", 404);
    }

    // Prevent deleting active quality rate (optional but recommended)
    if (existingQualityRate.isActive) {
      throw new AppError(
        "Active quality rate cannot be deleted. Please deactivate it first.",
        400,
      );
    }

    // Delete record
    await prisma.qualityRate.delete({
      where: { id: qualityId },
    });

    successResponse(res, null, "Quality rate deleted successfully");
  } catch (error) {
    next(error);
  }
};

// vendor listing API
const pad = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatDate = (d: Date) => {
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const buildDailyQualityRates = async (query: {
  startDate?: string;
  endDate?: string;
}) => {
  const createdAt =
    !query.startDate && !query.endDate
      ? undefined
      : {
          ...(query.startDate && { gte: new Date(query.startDate) }),
          ...(query.endDate && {
            lte: new Date(new Date(query.endDate).setHours(23, 59, 59, 999)),
          }),
        };

  const rates = await prisma.qualityRate.findMany({
    where: {
      isActive: true,
      ...(createdAt && { createdAt }),
    },
    orderBy: { createdAt: "asc" },
    select: { quality: true, rate: true, createdAt: true },
  });

  // Determine display range
  const startDate = query.startDate
    ? new Date(query.startDate)
    : rates.length
      ? new Date(rates[0].createdAt)
      : null;
  const endDate = query.endDate
    ? new Date(query.endDate)
    : rates.length
      ? new Date(rates[rates.length - 1].createdAt)
      : null;

  if (!startDate || !endDate) return [];
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // Carry-forward rate from before startDate
  const previousRate = await prisma.qualityRate.findFirst({
    where: { isActive: true, createdAt: { lt: startDate } },
    orderBy: { createdAt: "desc" },
    select: { rate: true },
  });

  if (!rates.length && !previousRate) return [];

  const latestRateBefore = (d: Date): number | undefined => {
    for (let i = rates.length - 1; i >= 0; i--) {
      if (rates[i].createdAt < d) return rates[i].rate;
    }
    return undefined;
  };

  const dailyEntries: Array<{
    rate: number;
    date: string;
    createdAt: Date;
  }> = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const key = toDateKey(cursor);
    const dayRates = rates.filter((r) => toDateKey(r.createdAt) === key);

    if (dayRates.length) {
      for (const r of dayRates) {
        dailyEntries.push({
          rate: r.rate,
          date: formatDate(r.createdAt),
          createdAt: r.createdAt,
        });
      }
    } else {
      const fallbackRate = previousRate?.rate ?? latestRateBefore(cursor) ?? 0;
      dailyEntries.push({
        rate: fallbackRate,
        date: formatDate(cursor),
        createdAt: new Date(cursor),
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  dailyEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return dailyEntries;
};

export const listActiveQualityRates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);

    const vendor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        vendorRate: true,
        factoryRateDiff: true,
        masterVendor: true,
      },
    });

    if (!vendor) throw new AppError("Vendor not found", 404);

    const dailyEntries = await buildDailyQualityRates(req.query as any);

    if (!dailyEntries.length) {
      throw new AppError("No active quality rates found", 404);
    }

    const diff = vendor.factoryRateDiff || 0;
    const withDiff = (e: (typeof dailyEntries)[0]) => ({
      ...e,
      rate: e.rate + diff,
    });

    const latestDbEntry = dailyEntries[0];
    const latestEntry = withDiff(latestDbEntry);
    const vendorRate = latestEntry.rate;

    if (vendor.masterVendor) {
      return successResponse(
        res,
        { vendorRate, qualityRates: dailyEntries.map(withDiff) },
        "Quality rates fetched",
      );
    }

    return successResponse(
      res,
      { vendorRate, qualityRates: [latestDbEntry] },
      "Latest quality rate fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const getVendorQualityRates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { vendorId } = req.params;

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { factoryRateDiff: true, name: true },
    });

    if (!vendor) throw new AppError("Vendor not found", 404);

    const dailyEntries = await buildDailyQualityRates(req.query as any);

    if (!dailyEntries.length) {
      throw new AppError("No quality rates found", 404);
    }

    const diff = vendor.factoryRateDiff || 0;
    const withDiff = (e: (typeof dailyEntries)[0]) => ({
      ...e,
      rate: e.rate + diff,
    });

    return successResponse(
      res,
      {
        vendorId,
        vendorName: vendor.name,
        factoryRateDiff: diff,
        vendorRate: withDiff(dailyEntries[0]).rate,
        qualityRates: dailyEntries.map(withDiff),
      },
      "Vendor quality rates fetched",
    );
  } catch (error) {
    next(error);
  }
};
