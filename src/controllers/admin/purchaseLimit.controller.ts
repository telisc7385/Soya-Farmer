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
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, purchaseLimitQtlPerHectare: true },
    });
    if (!admin) throw new AppError("Admin not found", 404);
    successResponse(
      res,
      { adminId: admin.id, purchaseLimitQtlPerHectare: admin.purchaseLimitQtlPerHectare },
      "Purchase limit fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError("Unauthorized", 401);
    const { value } = req.body;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError("value must be a positive number", 400);
    }

    const updated = await prisma.user.update({
      where: { id: adminId },
      data: { purchaseLimitQtlPerHectare: parsed },
      select: { id: true, purchaseLimitQtlPerHectare: true },
    });

    successResponse(res, updated, "Purchase limit updated");
  } catch (error) {
    next(error);
  }
};
