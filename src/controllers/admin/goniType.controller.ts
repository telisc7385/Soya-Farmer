import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AppError } from "../../core/appError";
import { AuthRequest } from "../../middleware/auth.middleware";

export const createGoniType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);
    const userId = req.user.id;
    const { name, weightPerBag, isTracked = false } = req.body;

    const goniType = await prisma.$transaction(async (tx) => {
      if (isTracked) {
        await tx.goniType.updateMany({
          where: { isTracked: true },
          data: { isTracked: false },
        });
      }

      return tx.goniType.create({
        data: {
          name,
          weightPerBag,
          isTracked,
          createdBy: userId,
        },
      });
    });

    createdResponse(res, goniType, "Goni type created");
  } catch (error) {
    next(error);
  }
};

export const updateGoniType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { goniTypeId } = req.params;
    const { name, weightPerBag, isActive, isTracked } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      if (isTracked === true) {
        await tx.goniType.updateMany({
          where: { isTracked: true, NOT: { id: goniTypeId } },
          data: { isTracked: false },
        });
      }

      return tx.goniType.update({
        where: { id: goniTypeId },
        data: {
          name,
          weightPerBag,
          isActive,
          ...(typeof isTracked === "boolean" ? { isTracked } : {}),
        },
      });
    });

    successResponse(res, updated, "Goni type updated");
  } catch (error) {
    next(error);
  }
};

export const listGoniTypes = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const goniTypes = await prisma.goniType.findMany({
      orderBy: { createdAt: "desc" },
    });

    successResponse(res, goniTypes, "Goni types fetched");
  } catch (error) {
    next(error);
  }
};
