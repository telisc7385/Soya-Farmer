import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { AppError } from "../../core/appError";
import { successResponse } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";

export const getPurchaseLimit = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [latest, history] = await Promise.all([
      prisma.purchaseLimit.findFirst({
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseLimit.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    successResponse(
      res,
      {
        purchaseLimitQtlPerHectare: latest?.value ?? null,
        updatedAt: latest?.createdAt ?? null,
        history,
      },
      "Purchase limit fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const createPurchaseLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError("Unauthorized", 401);
    const { value, note } = req.body;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError("value must be a positive number", 400);
    }

    const created = await prisma.purchaseLimit.create({
      data: {
        value: parsed,
        note: note ?? null,
      },
    });

    successResponse(res, created, "Purchase limit created");
  } catch (error) {
    next(error);
  }
};