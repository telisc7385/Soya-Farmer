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

    const qualityRate = await prisma.qualityRate.upsert({
      where: { quality },
      create: {
        quality,
        rate,
        isActive: isActive ?? true,
        createdBy: userId,
      },
      update: {
        rate,
        ...(isActive !== undefined ? { isActive } : {}),
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
      orderBy: { quality: "asc" },
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
export const listActiveQualityRates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);

    console.log("Fetching active quality rates for vendor:", req.user.id);

    const vendor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { vendorRate: true, factoryRateDiff: true },
    });

    if (!vendor) throw new AppError("Vendor not found", 404);

    const qualityRatesResponse = await prisma.qualityRate.findMany({
      where: { isActive: true },
      orderBy: { quality: "asc" },
      select: {
        quality: true,
        rate: true,
      },
    });

    const qualityRates = qualityRatesResponse.map((qr) => ({
      quality: qr.quality,
      rate: qr.rate + vendor.factoryRateDiff,
    }));

    successResponse(
      res,
      { vendorRate: vendor.vendorRate, qualityRates },
      "Quality rates fetched",
    );
  } catch (error) {
    next(error);
  }
};
