import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AppError } from "../../core/appError";
import { AuthRequest } from "../../middleware/auth.middleware";

export const createDeductionMaster = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      name,
      type,
      baseAmount,
      formulaExpression,
      variableValues,
      variables = [],
    } = req.body;

    if (!req.user) throw new AppError("Unauthorized", 401);

    if (type === "FIXED" && typeof baseAmount !== "number") {
      throw new AppError("baseAmount is required for FIXED deductions", 400);
    }
    if (type === "FORMULA" && !formulaExpression) {
      throw new AppError("formulaExpression is required for FORMULA deductions", 400);
    }
    if (type === "FORMULA") {
      const existingFormula = await prisma.deductionMaster.findFirst({
        where: { type: "FORMULA" },
        select: { id: true },
      });
      if (existingFormula) {
        throw new AppError("Only one FORMULA deduction master is allowed", 400);
      }
    }

    const master = await prisma.$transaction(async (tx) => {
      const created = await tx.deductionMaster.create({
        data: {
          name,
          type,
          baseAmount,
          formulaExpression,
          variableValues,
          createdBy: req.user!.id,
        },
      });

      if (variables.length) {
        await tx.deductionVariable.createMany({
          data: variables.map((variable: any) => ({
            masterId: created.id,
            code: variable.code,
            label: variable.label,
            unitHint: variable.unitHint,
          })),
        });
      }

      return created;
    });

    createdResponse(res, master, "Deduction master created");
  } catch (error) {
    next(error);
  }
};

export const updateDeductionMaster = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { masterId } = req.params;
    const {
      name,
      type,
      baseAmount,
      formulaExpression,
      variableValues,
      variables = [],
    } = req.body;

    const existing = await prisma.deductionMaster.findUnique({
      where: { id: masterId },
    });

    if (!existing) throw new AppError("Deduction master not found", 404);

    if (type === "FIXED" && typeof baseAmount !== "number") {
      throw new AppError("baseAmount is required for FIXED deductions", 400);
    }
    if (type === "FORMULA" && !formulaExpression) {
      throw new AppError("formulaExpression is required for FORMULA deductions", 400);
    }
    if (type === "FORMULA") {
      const existingFormula = await prisma.deductionMaster.findFirst({
        where: {
          type: "FORMULA",
          id: { not: masterId },
        },
        select: { id: true },
      });
      if (existingFormula) {
        throw new AppError("Only one FORMULA deduction master is allowed", 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.deductionMaster.update({
        where: { id: masterId },
        data: {
          name,
          type,
          baseAmount,
          formulaExpression,
          variableValues,
        },
      });

      await tx.deductionVariable.deleteMany({
        where: { masterId },
      });

      if (variables.length) {
        await tx.deductionVariable.createMany({
          data: variables.map((variable: any) => ({
            masterId,
            code: variable.code,
            label: variable.label,
            unitHint: variable.unitHint,
          })),
        });
      }
    });

    successResponse(res, null, "Deduction master updated");
  } catch (error) {
    next(error);
  }
};

export const toggleDeductionMaster = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { masterId } = req.params;
    const { isActive } = req.body;

    const updated = await prisma.deductionMaster.update({
      where: { id: masterId },
      data: { isActive },
    });

    successResponse(res, updated, "Deduction master toggled");
  } catch (error) {
    next(error);
  }
};

export const listDeductionMasters = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const masters = await prisma.deductionMaster.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        variables: true,
      },
    });

    successResponse(res, masters, "Deduction masters fetched");
  } catch (error) {
    next(error);
  }
};
