import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AppError } from "../../core/appError";
import { AuthRequest } from "../../middleware/auth.middleware";

type UnitHintRangeEntry = {
  condition: string;
  factor: number | string;
};

const formatUnitHint = (
  unitHint?: string | UnitHintRangeEntry[],
): string | undefined => {
  if (!unitHint) return undefined;
  if (typeof unitHint === "string") {
    const trimmed = unitHint.trim();
    return trimmed || undefined;
  }
  const segments = unitHint
    .map((entry) => {
      const condition = entry?.condition?.trim();
      const factorValue =
        typeof entry.factor === "number"
          ? entry.factor.toString()
          : entry.factor?.toString().trim();
      if (!condition || !factorValue) return undefined;
      return `${condition}:${factorValue}`;
    })
    .filter((segment): segment is string => Boolean(segment));
  if (!segments.length) return undefined;
  return `range:${segments.join(",")}`;
};

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
      throw new AppError(
        "formulaExpression is required for FORMULA deductions",
        400,
      );
    }
    // Allow multiple FORMULA deduction masters (e.g., FM, Damage, Moisture, etc.)

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
            unitHint: formatUnitHint(variable.unitHint),
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
      throw new AppError(
        "formulaExpression is required for FORMULA deductions",
        400,
      );
    }
    // Allow multiple FORMULA deduction masters (e.g., FM, Damage, Moisture, etc.)

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
            unitHint: formatUnitHint(variable.unitHint),
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

    const updatedMasters = masters.map((master) => {
      let divisor = 1;

      // Check if formula contains division
      const match = master.formulaExpression?.match(/\/\s*(\d+)/);
      if (match) {
        divisor = Number(match[1]);
      }

      return {
        ...master,
        percentRatio: `1/${divisor}`,
      };
    });

    successResponse(res, updatedMasters, "Deduction masters fetched");
  } catch (error) {
    next(error);
  }
};
