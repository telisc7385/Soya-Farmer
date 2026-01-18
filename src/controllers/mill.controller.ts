import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";

export const createMill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const mill = await prisma.mill.create({ data: req.body });
    createdResponse(res, mill, "Mill created successfully");
  } catch (e) {
    next(e);
  }
};

export const updateMill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { millId } = req.params;

    const checkMill = await prisma.mill.findUnique({ where: { id: millId } });

    if (!checkMill) {
      throw new AppError("Mill not found", 404);
    }
    const mill = await prisma.mill.update({
      where: { id: millId },
      data: req.body,
    });
    createdResponse(res, mill, "Mill Updated successfully");
  } catch (e) {
    next(e);
  }
};

export const getMills = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const mills = await prisma.mill.findMany({
      orderBy: { createdAt: "desc" },
    });
    successResponse(res, mills, "Mills fetched");
  } catch (e) {
    next(e);
  }
};
