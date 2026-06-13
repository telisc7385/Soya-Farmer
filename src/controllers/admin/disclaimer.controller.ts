import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { successResponse } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";

const DISCLAIMER_KEY = "DISCLAIMER";

export const getDisclaimer = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: DISCLAIMER_KEY },
      select: { value: true, updatedAt: true },
    });

    successResponse(
      res,
      { text: setting?.value ?? "", updatedAt: setting?.updatedAt ?? null },
      "Disclaimer fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const updateDisclaimer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string") {
      throw new AppError("text must be a string", 400);
    }

    const setting = await prisma.appSetting.upsert({
      where: { key: DISCLAIMER_KEY },
      create: { key: DISCLAIMER_KEY, value: text },
      update: { value: text },
      select: { value: true, updatedAt: true },
    });

    successResponse(
      res,
      { text: setting.value, updatedAt: setting.updatedAt },
      "Disclaimer updated",
    );
  } catch (error) {
    next(error);
  }
};
