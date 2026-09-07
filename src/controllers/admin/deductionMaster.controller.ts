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

export const assignVendorDeductions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { vendorId } = req.params;
    const { masterIds } = req.body;

    if (!Array.isArray(masterIds)) {
      throw new AppError("masterIds must be an array", 400);
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { id: true, role: true },
    });
    if (!vendor) throw new AppError("Vendor not found", 404);
    if (vendor.role !== "VENDOR") {
      throw new AppError("User is not a vendor", 400);
    }

    const uniqueIds = Array.from(new Set(masterIds));

    if (uniqueIds.length > 0) {
      const count = await prisma.deductionMaster.count({
        where: { id: { in: uniqueIds } },
      });
      if (count !== uniqueIds.length) {
        throw new AppError("One or more deduction masters not found", 404);
      }
    }

    await prisma.$transaction([
      prisma.deductionAssignment.deleteMany({ where: { vendorId } }),
      prisma.deductionAssignment.createMany({
        data: uniqueIds.map((masterId) => ({ vendorId, masterId })),
        skipDuplicates: true,
      }),
    ]);

    successResponse(
      res,
      { vendorId, masterIds: uniqueIds },
      "Vendor deduction assignments updated",
    );
  } catch (error) {
    next(error);
  }
};

export const assignDeductionToAllVendors = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { masterId } = req.params;

    const master = await prisma.deductionMaster.findUnique({
      where: { id: masterId },
      select: { id: true },
    });
    if (!master) throw new AppError("Deduction master not found", 404);

    const vendors = await prisma.user.findMany({
      where: { role: "VENDOR" },
      select: { id: true },
    });

    await prisma.deductionAssignment.createMany({
      data: vendors.map((vendor) => ({ vendorId: vendor.id, masterId })),
      skipDuplicates: true,
    });

    successResponse(
      res,
      { masterId, vendorCount: vendors.length },
      "Deduction master assigned to all vendors",
    );
  } catch (error) {
    next(error);
  }
};

const getAssignedDeductionMasters = async (vendorId: string) => {
  const masters = await prisma.deductionMaster.findMany({
    where: {
      isActive: true,
      assignments: { some: { vendorId } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      variables: true,
    },
  });

  return masters.map((master) => {
    let divisor = 1;
    const match = master.formulaExpression?.match(/\/\s*(\d+)/);
    if (match) {
      divisor = Number(match[1]);
    }
    return {
      ...master,
      percentRatio: `1/${divisor}`,
    };
  });
};

export const getVendorDeductions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const updatedMasters = await getAssignedDeductionMasters(vendorId);

    successResponse(res, updatedMasters, "Vendor deduction masters fetched");
  } catch (error) {
    next(error);
  }
};

export const getAdminVendorDeductions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { vendorId } = req.params;

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { id: true, role: true },
    });
    if (!vendor) throw new AppError("Vendor not found", 404);
    if (vendor.role !== "VENDOR") {
      throw new AppError("User is not a vendor", 400);
    }

    const updatedMasters = await getAssignedDeductionMasters(vendorId);

    successResponse(res, updatedMasters, "Vendor deduction masters fetched");
  } catch (error) {
    next(error);
  }
};
