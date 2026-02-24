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

    // Check if quality rate exists
    const existingQualityRate = await prisma.qualityRate.findUnique({
      where: { id: qualityId },
    });

    if (!existingQualityRate) {
      throw new AppError("Quality rate not found", 404);
    }

    // Toggle isActive (true <-> false)
    const updatedQualityRate = await prisma.qualityRate.update({
      where: { id: qualityId },
      data: { isActive: !existingQualityRate.isActive },
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

// vendor listing API
export const listActiveQualityRates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);

    const vendor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { vendorRate: true },
    });

    if (!vendor) throw new AppError("Vendor not found", 404);

    const qualityRates = await prisma.qualityRate.findMany({
      where: { isActive: true },
      orderBy: { quality: "asc" },
      select: {
        quality: true,
        rate: true,
      },
    });

    successResponse(
      res,
      { vendorRate: vendor.vendorRate, qualityRates },
      "Quality rates fetched",
    );
  } catch (error) {
    next(error);
  }
};
