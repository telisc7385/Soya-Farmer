import { NextFunction, Response } from "express";
import { BagMovementType } from "@prisma/client";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../core/appError";
import { generateBillNo } from "../../utils/billNo";
import { checkFarmer } from "../../repositories/checkFarmer.repository";
import { formulaEngine } from "../../services/formulaEngine.service";
import { roundTo } from "../../utils/number";
import { attachDeductionDetails } from "../../utils/deductionDetails";
import { buildBillingCalculationDetails } from "../../utils/billingCalculation";

const evaluateRangeCondition = (
  condition: string,
  measurement?: number,
  reference?: number,
): boolean => {
  if (measurement === undefined || condition.trim() === "") return false;
  const normalized = condition.replace(/\s+/g, "");
  if (!normalized) return false;

  const resolveValue = (token: string): number | undefined => {
    if (!token) return undefined;
    if (token.toLowerCase() === "variablevalue") {
      return reference;
    }
    const parsed = Number(token);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  if (normalized.startsWith("<=")) {
    const target = resolveValue(normalized.slice(2));
    return target !== undefined && measurement <= target;
  }
  if (normalized.startsWith(">=")) {
    const target = resolveValue(normalized.slice(2));
    return target !== undefined && measurement >= target;
  }
  if (normalized.startsWith(">")) {
    const target = resolveValue(normalized.slice(1));
    return target !== undefined && measurement > target;
  }
  if (normalized.startsWith("<")) {
    const target = resolveValue(normalized.slice(1));
    return target !== undefined && measurement < target;
  }
  if (normalized.includes("-")) {
    const [rawMin, rawMax] = normalized.split("-");
    const min = resolveValue(rawMin);
    const max = resolveValue(rawMax);
    if (min === undefined || max === undefined) {
      return false;
    }
    return measurement >= min && measurement <= max;
  }
  const exact = resolveValue(normalized);
  return exact !== undefined && measurement === exact;
};

const parseUnitHint = (
  unitHint?: string | null,
  measurement?: number,
  reference?: number,
): number => {
  if (!unitHint) return 1;
  const trimmed = unitHint.trim();
  if (!trimmed) return 1;

  if (trimmed.toLowerCase().startsWith("range:")) {
    const rangePart = trimmed.slice(6);
    const entries = rangePart
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (const entry of entries) {
      const [conditionRaw, factorRaw] = entry
        .split(":")
        .map((part) => part.trim());
      if (!conditionRaw || !factorRaw) continue;
      const factor = Number(factorRaw);
      if (Number.isNaN(factor)) continue;
      if (evaluateRangeCondition(conditionRaw, measurement, reference)) {
        return factor;
      }
    }
  }

  if (trimmed.includes("/")) {
    const [numRaw, denRaw] = trimmed.split("/");
    const num = Number(numRaw);
    const den = Number(denRaw);
    if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) || parsed === 0 ? 1 : parsed;
};

const withGoniAmount = (bill: any) => {
  const calculationDetails = buildBillingCalculationDetails(bill);
  const perQtlLabDeduction = roundTo(
    ((bill.ratePerUnit ?? 0) *
      (calculationDetails?.totalLabDeductionPercent ?? 0)) /
      100,
  );

  return {
    ...bill,
    goniDeductionAmount: calculationDetails.goniDeductionAmount,
    calculationDetails,
    perQtlLabDeduction,
  };
};

const compactTotals = (totals: any) => ({
  grossAmount: totals?.grossAmount ?? 0,
  totalDeductions: totals?.totalDeductions ?? 0,
  goniWeight: totals?.goniWeight ?? 0,
  goniDeductionAmount: totals?.goniDeductionAmount ?? 0,
  netPayable: totals?.netPayable ?? 0,
});

const compactDeductionRows = (calculationDetails: any) =>
  Array.isArray(calculationDetails?.deductions)
    ? calculationDetails.deductions.map((row: any) => ({
        deductionId: row.deductionId,
        masterId: row.masterId,
        label: row.label,
        type: row.type,
        deductionPercent: row.deductionPercent,
        deductionWeight: row.deductionWeight,
        deductionAmount: row.deductionAmount,
        actualInputs: row.actualInputs,
        allowedInputs: row.allowedInputs,
        deductedInputs: row.deductedInputs,
        variableDetails: row.variableDetails,
      }))
    : [];

const compactCalculationDetails = (calculationDetails: any) => ({
  totalQuantityReceived: calculationDetails?.totalQuantityReceived ?? 0,
  ratePerUnit: calculationDetails?.ratePerUnit ?? 0,
  bagWeight: calculationDetails?.bagWeight ?? 0,
  netWeightForLab: calculationDetails?.netWeightForLab ?? 0,
  goniDeductionAmount: calculationDetails?.goniDeductionAmount ?? 0,
  totalLabDeductionPercent: calculationDetails?.totalLabDeductionPercent ?? 0,
  totalLabDeductionWeight: calculationDetails?.totalLabDeductionWeight ?? 0,
  totalLabDeductionAmount: calculationDetails?.totalLabDeductionAmount ?? 0,
  totalFixedDeductionAmount: calculationDetails?.totalFixedDeductionAmount ?? 0,
  finalNetPayableWeight: calculationDetails?.finalNetPayableWeight ?? 0,
  amountAfterLab: calculationDetails?.amountAfterLab ?? 0,
  finalPayableAmount: calculationDetails?.finalPayableAmount ?? 0,
  rateAfterLabDeduction: calculationDetails?.rateAfterLabDeduction ?? 0,
  rateAfterLabDeductionRounded:
    calculationDetails?.rateAfterLabDeductionRounded ?? 0,
  recalculatedTotal: calculationDetails?.recalculatedTotal ?? 0,
  pricedQuantity: calculationDetails?.pricedQuantity ?? 0,
});

const ensureDraftBill = async (billId: string, vendorId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      deductions: true,
      gonis: {
        include: { goniType: true },
      },
    },
  });
  if (!bill) throw new AppError("Bill not found", 404);
  if (bill.vendorId !== vendorId)
    throw new AppError("Unauthorized bill access", 403);
  if (bill.status !== "DRAFT")
    throw new AppError("Bill already finalized", 400);
  return bill;
};

const recalcTotals = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      deductions: {
        include: {
          master: true,
        },
      },
    },
  });
  if (!bill) throw new AppError("Bill not found while recalculating", 404);
  const deductionTotal = roundTo(
    bill.deductions.reduce((sum, d) => sum + d.value, 0),
  );
  const gross = bill.grossAmount ?? 0;
  const calculationDetails = buildBillingCalculationDetails(bill);
  const netPayable = calculationDetails.finalPayableAmount;

  await prisma.bill.update({
    where: { id: billId },
    data: {
      totalAmount: netPayable,
      netPayable,
    },
  });

  return {
    grossAmount: gross,
    totalDeductions: deductionTotal,
    goniWeight: bill.goniWeight ?? 0,
    goniDeductionAmount: calculationDetails.goniDeductionAmount,
    netPayable,
    calculationDetails,
  };
};

export const createDraftBill = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);
    const {
      farmerId,
      billDate,
      quantity: rawQuantity,
      unit,
      rate,
      vehicleNumber,
      vehicleType,
      driverName,
    } = req.body;

    let quantity = rawQuantity;
    if (unit === "KG") {
      // Convert KG to QTL for storage and calculations
      quantity = roundTo(quantity / 100, 3);
    } else if (unit === "MT") {
      // Convert MT to QTL for storage and calculations
      quantity = roundTo(quantity * 10, 3);
    }

    await checkFarmer(farmerId);
    const grossAmount = roundTo(quantity * rate);

    const billNo = await generateBillNo();
    const draft = await prisma.bill.create({
      data: {
        billNo,
        billDate: billDate ? new Date(billDate) : new Date(),
        vendorId,
        farmerId,
        status: "DRAFT",
        primaryQuantity: quantity,
        // Keep quantity unit normalized to QTL in persistence layer
        primaryUnit: "QTL",
        ratePerUnit: rate,
        grossAmount,
        vehicleNumber,
        vehicleType,
        driverName,
        totalAmount: grossAmount,
        netPayable: grossAmount,
      },
    });
    const totals = await recalcTotals(draft.id);
    const hydrated = await prisma.bill.findUnique({
      where: { id: draft.id },
      include: {
        farmer: true,
        deductions: true,
        gonis: {
          include: { goniType: true },
        },
      },
    });

    const billWithGoni = withGoniAmount(hydrated);
    const calculationDetails = billWithGoni.calculationDetails;
    createdResponse(
      res,
      {
        bill: {
          id: billWithGoni.id,
          billNo: billWithGoni.billNo,
          billDate: billWithGoni.billDate,
          status: billWithGoni.status,
          primaryQuantity: billWithGoni.primaryQuantity,
          primaryUnit: billWithGoni.primaryUnit,
          ratePerUnit: billWithGoni.ratePerUnit,
          grossAmount: billWithGoni.grossAmount,
          totalAmount: billWithGoni.totalAmount,
          netPayable: billWithGoni.netPayable,
          vehicleNumber: billWithGoni.vehicleNumber,
          vehicleType: billWithGoni.vehicleType,
          driverName: billWithGoni.driverName,
          goniWeight: billWithGoni.goniWeight,
          goniCount:
            billWithGoni.gonis?.reduce(
              (sum: number, g: any) => sum + g.bagCount,
              0,
            ) ?? 0,
          gonis: billWithGoni.gonis,
          goniDeductionAmount: billWithGoni.goniDeductionAmount,
          farmer: billWithGoni.farmer,
          goniType: billWithGoni.goniType,
        },
        totals: compactTotals(totals),
        calculationDetails: compactCalculationDetails(calculationDetails),
        deductions: compactDeductionRows(calculationDetails),
      },
      "Bill draft created with quantity",
    );
  } catch (error) {
    next(error);
  }
};

export const calculateDeductions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { billId } = req.params;
    const bill = await ensureDraftBill(billId, vendorId);

    const { deductions } = req.body;

    const masterIds = deductions.map((d: any) => d.masterId);

    const masters = await prisma.deductionMaster.findMany({
      where: {
        id: { in: masterIds },
        isActive: true,
      },
      include: {
        variables: { orderBy: { createdAt: "asc" } },
      },
    });

    const masterMap = new Map(masters.map((m) => [m.id, m]));

    const recordsToCreate = [];
    const deductionDetails = [];

    for (const deduction of deductions) {
      const master = masterMap.get(deduction.masterId);

      if (!master) {
        throw new AppError("Deduction master not found or inactive", 404);
      }

      let value = 0;
      let payload: Record<string, any> = {};
      let actualInputs: Record<string, number> = {};
      let customInputs: Record<string, number> = {};
      let deductedInputs: Record<string, number> = {};
      let variableDetails: any;

      if (master.type === "FIXED") {
        value = master.baseAmount ?? 0;
      } else {
        actualInputs = deduction.actualInputs || {};
        customInputs = deduction.customInputs || {};
        deductedInputs = {} as Record<string, number>;
        const deductedAmounts: Record<string, number> = {};

        const variableCodes =
          master.variables?.length > 0
            ? master.variables.map((v) => v.code)
            : Array.from(
                new Set([
                  ...Object.keys(actualInputs),
                  ...Object.keys(customInputs),
                ]),
              );

        if (!variableCodes.length) {
          throw new AppError("No inputs provided for formula deduction", 400);
        }

        const variableMeta = new Map(
          (master.variables || []).map((v) => [v.code, v]),
        );

        for (const code of variableCodes) {
          if (typeof actualInputs[code] !== "number") {
            throw new AppError(`Missing actual input for ${code}`, 400);
          }
          if (typeof customInputs[code] !== "number") {
            throw new AppError(`Missing custom input for ${code}`, 400);
          }

          const extra =
            (customInputs[code] as number) - (actualInputs[code] as number);
          const rawExtra = extra > 0 ? extra : 0;
          const unitHint = variableMeta.get(code)?.unitHint ?? "1";
          const measurementValue = customInputs[code];
          const referenceValue = actualInputs[code];
          const unitFactor = parseUnitHint(
            unitHint,
            measurementValue,
            referenceValue,
          );
          deductedInputs[code] = roundTo(rawExtra * unitFactor, 4);
        }

        payload = {
          actualInputs,
          customInputs,
          deductedInputs,
        };

        const totalPercent = formulaEngine.evaluate(
          master.formulaExpression || "",
          deductedInputs,
        );
        const safeTotalPercent = Math.max(0, totalPercent);
        const baseWeightForLab = roundTo(
          Math.max((bill.primaryQuantity ?? 0) - (bill.goniWeight ?? 0), 0),
          3,
        );
        const ratePerUnit = bill.ratePerUnit ?? 0;
        const deductionWeight = roundTo(
          (baseWeightForLab * safeTotalPercent) / 100,
          3,
        );
        value = roundTo(deductionWeight * ratePerUnit);

        const deductedWeights: Record<string, number> = {};

        for (const code of Object.keys(deductedInputs)) {
          const percent = deductedInputs[code] ?? 0;
          const weight = roundTo((baseWeightForLab * percent) / 100, 3);
          deductedWeights[code] = weight;
          deductedAmounts[code] = roundTo(weight * ratePerUnit);
        }

        payload.baseWeightForLab = baseWeightForLab;
        payload.totalDeductionPercent = roundTo(safeTotalPercent, 4);
        payload.deductionWeight = deductionWeight;
        payload.deductionAmount = value;
        payload.ratePerUnit = ratePerUnit;
        payload.deductedWeights = deductedWeights;
        payload.deductedAmounts = deductedAmounts;

        variableDetails = (master.variables || []).map((variable) => ({
          code: variable.code,
          label: variable.label,
          unitHint: variable.unitHint,
          actual: actualInputs?.[variable.code] ?? 0,
          custom: customInputs?.[variable.code] ?? 0,
          deducted: deductedInputs?.[variable.code] ?? 0,
          deductedWeight: deductedWeights?.[variable.code] ?? 0,
          deductionValue: deductedAmounts?.[variable.code] ?? 0,
        }));

        payload.variableDetails = variableDetails;
      }

      recordsToCreate.push({
        billId,
        masterId: master.id,
        label: master.name,
        value,
        payload,
      });

      deductionDetails.push({
        masterId: master.id,
        label: master.name,
        actualInputs,
        customInputs,
        deductedInputs,
        deductedAmounts:
          payload && typeof payload === "object"
            ? (payload as any).deductedAmounts
            : undefined,
        variableDetails,
        totalDeductionPercent:
          payload && typeof payload === "object"
            ? (payload as any).totalDeductionPercent
            : 0,
        deductionWeight:
          payload && typeof payload === "object"
            ? (payload as any).deductionWeight
            : 0,
        deductedAmount: value,
      });
    }

    await prisma.$transaction([
      prisma.billDeduction.deleteMany({ where: { billId } }),
      prisma.billDeduction.createMany({
        data: recordsToCreate,
      }),
    ]);

    const totals = await recalcTotals(billId);
    const calculationDetails = totals.calculationDetails;

    successResponse(
      res,
      {
        totals: compactTotals(totals),
        calculationDetails: compactCalculationDetails(calculationDetails),
        deductions: compactDeductionRows(calculationDetails),
      },
      "Deductions recalculated",
    );
  } catch (error) {
    next(error);
  }
};

export const applyGoniDeduction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { billId } = req.params;
    await ensureDraftBill(billId, vendorId);

    const { gonis } = req.body;
    const requestedTypeIds: string[] = Array.from(
      new Set(gonis.map((g: { goniTypeId: string }) => g.goniTypeId)),
    );
    const goniTypes = await prisma.goniType.findMany({
      where: { id: { in: requestedTypeIds }, isActive: true },
    });
    const goniTypeMap = new Map(goniTypes.map((type) => [type.id, type]));
    const invalidTypeIds = requestedTypeIds.filter((id) => !goniTypeMap.has(id));
    if (invalidTypeIds.length) {
      throw new AppError(
        `Invalid or inactive goni type(s): ${invalidTypeIds.join(", ")}`,
        400,
      );
    }

    const bagCountByType = new Map<string, number>();
    for (const g of gonis) {
      const current = bagCountByType.get(g.goniTypeId) ?? 0;
      bagCountByType.set(g.goniTypeId, current + g.bagCount);
    }

    let totalWeightKg = 0;
    const records = [];

    for (const [goniTypeId, bagCount] of bagCountByType.entries()) {
      const goniType = goniTypeMap.get(goniTypeId)!;
      const weightKg = bagCount * goniType.weightPerBag;

      totalWeightKg += weightKg;

      records.push({
        billId,
        goniTypeId,
        bagCount,
        weight: weightKg / 100, // convert to QTL
      });
    }

    await prisma.$transaction([
      prisma.billGoni.deleteMany({ where: { billId } }),
      prisma.billGoni.createMany({ data: records }),
      prisma.bill.update({
        where: { id: billId },
        data: {
          goniWeight: totalWeightKg / 100,
        },
      }),
    ]);

    const totals = await recalcTotals(billId);

    successResponse(
      res,
      {
        totals: compactTotals(totals),
        calculationDetails: compactCalculationDetails(
          totals.calculationDetails,
        ),
        deductions: compactDeductionRows(totals.calculationDetails),
      },
      "Goni deduction applied",
    );
  } catch (error) {
    next(error);
  }
};

export const previewDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { billId } = req.params;
    await ensureDraftBill(billId, vendorId);

    const response = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        farmer: true,
        deductions: {
          include: {
            master: {
              include: {
                variables: true,
              },
            },
          },
        },
        gonis: {
          include: {
            goniType: true,
          },
        },
      },
    });

    const billWithDetails = attachDeductionDetails(response);
    const billWithGoni = withGoniAmount(billWithDetails);

    successResponse(res, billWithGoni, "Bill preview");
  } catch (error) {
    next(error);
  }
};

export const confirmDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { billId } = req.params;
    const bill = await ensureDraftBill(billId, vendorId);

    if (!bill.primaryQuantity || !bill.primaryUnit || !bill.ratePerUnit) {
      throw new AppError("Quantity information missing", 400);
    }
    if ((bill.netPayable ?? 0) <= 0) {
      throw new AppError("Net payable must be positive", 400);
    }

    // Use transaction to update bill and create stock atomically
    await prisma.$transaction(async (tx) => {
      // Update bill status to PENDING
      await tx.bill.update({
        where: { id: billId },
        data: {
          status: "PENDING",
        },
      });

      const gonis = await prisma.billGoni.findMany({
        where: { billId },
      });

      const totalBags = gonis.reduce((sum, g) => sum + g.bagCount, 0);
      const stockWeight = roundTo(
        Math.max((bill.primaryQuantity ?? 0) - (bill.goniWeight ?? 0), 0),
        3,
      );

      // Auto-create stock entry for vendor
      await tx.stock.create({
        data: {
          vendorId,
          billId,
          // Stock should represent net commodity after bag-weight deduction
          weight: stockWeight,
          unit: "QTL",
          bagCount: totalBags,
          status: "AVAILABLE",
        },
      });

      // Explicitly record farmer -> vendor bag receipt at finalization time
      const trackedGonis = await tx.billGoni.findMany({
        where: {
          billId,
          goniType: {
            isTracked: true,
            isActive: true,
          },
        },
        select: {
          goniTypeId: true,
          bagCount: true,
        },
      });

      if (trackedGonis.length) {
        await tx.bagMovement.createMany({
          data: trackedGonis.map((g) => ({
            vendorId,
            farmerId: bill.farmerId,
            goniTypeId: g.goniTypeId,
            bagCount: g.bagCount,
            movementType: BagMovementType.FARMER_TO_VENDOR,
            notes: `Captured from bill ${bill.billNo}`,
            createdById: vendorId,
          })),
        });
      }
    });

    successResponse(res, null, "Bill confirmed and stock added");
  } catch (error) {
    next(error);
  }
};
