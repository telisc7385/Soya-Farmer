import { NextFunction, Response } from "express";
import { BagMovementType } from "@prisma/client";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../core/appError";
import { generateBillNo } from "../../utils/billNo";
import { checkFarmer } from "../../repositories/checkFarmer.repository";
import { formulaEngine } from "../../services/formulaEngine.service";
import { applyAdvanceAdjustmentOnBillConfirm } from "../../services/paymentManagement.service";
import { roundTo } from "../../utils/number";
import { attachDeductionDetails } from "../../utils/deductionDetails";
import { buildBillingCalculationDetails } from "../../utils/billingCalculation";
import { getPurchaseLimitQtlPerHectare } from "../../services/purchaseLimit.service";
import { saveUploadedFile } from "../../utils/upload";

const parseUnitHint = (unitHint?: string | null): number => {
  if (!unitHint) return 1;
  const trimmed = unitHint.trim();
  if (!trimmed) return 1;

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

const calculateDeductedInput = (
  code: string,
  unitHint: string | null | undefined,
  measurement: number,
  reference: number,
): number => {
  const rawExtra = Math.max(measurement - reference, 0);
  if (rawExtra <= 0) return 0;

  const trimmed = unitHint?.trim();
  if (!trimmed?.toLowerCase().startsWith("range:")) {
    return roundTo(rawExtra * parseUnitHint(unitHint), 4);
  }

  const resolveValue = (token: string): number | undefined => {
    if (!token) return undefined;
    if (token.toLowerCase() === "variablevalue") {
      return reference;
    }
    const parsed = Number(token);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const rangePart = trimmed.slice(6);
  const entries = rangePart
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let total = 0;
  let previousUpper: number | undefined;
  let highestFiniteUpper = reference;
  let hasOpenEndedUpperRange = false;

  for (const entry of entries) {
    const [conditionRaw, factorRaw] = entry
      .split(":")
      .map((part) => part.trim());
    if (!conditionRaw || !factorRaw) continue;

    const factor = (() => {
      const trimmed = factorRaw.trim();
      if (trimmed.includes("/")) {
        const [n, d] = trimmed.split("/");
        const num = Number(n);
        const den = Number(d);
        return !Number.isNaN(num) && !Number.isNaN(den) && den !== 0
          ? num / den
          : NaN;
      }
      return Number(trimmed);
    })();
    if (Number.isNaN(factor)) continue;

    const condition = conditionRaw.replace(/\s+/g, "");
    let lower = Number.NEGATIVE_INFINITY;
    let upper = Number.POSITIVE_INFINITY;

    if (condition.startsWith("<=")) {
      const target = resolveValue(condition.slice(2));
      if (target === undefined) continue;
      upper = target;
    } else if (condition.startsWith("<")) {
      const target = resolveValue(condition.slice(1));
      if (target === undefined) continue;
      upper = target;
    } else if (condition.startsWith(">=")) {
      const target = resolveValue(condition.slice(2));
      if (target === undefined) continue;
      lower = target;
      hasOpenEndedUpperRange = true;
    } else if (condition.startsWith(">")) {
      const target = resolveValue(condition.slice(1));
      if (target === undefined) continue;
      lower = target;
      hasOpenEndedUpperRange = true;
    } else if (condition.includes("-")) {
      const [rawMin, rawMax] = condition.split("-");
      const min = resolveValue(rawMin);
      const max = resolveValue(rawMax);
      if (min === undefined || max === undefined) continue;
      lower =
        previousUpper !== undefined && min > previousUpper
          ? previousUpper
          : min;
      upper = max;
    } else {
      const exact = resolveValue(condition);
      if (exact === undefined) continue;
      lower = previousUpper ?? exact;
      upper = exact;
    }

    const from = Math.max(reference, lower);
    const to = Math.min(measurement, upper);
    if (to > from) {
      total += (to - from) * factor;
    }

    if (Number.isFinite(upper)) {
      previousUpper = upper;
      highestFiniteUpper = Math.max(highestFiniteUpper, upper);
    }
  }

  if (!hasOpenEndedUpperRange && measurement > highestFiniteUpper) {
    throw new AppError(
      `${code} value is greater than configured quality range. Very low quality maal.`,
      400,
    );
  }

  return roundTo(total, 4);
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
      billId,
      farmerId,
      billDate,
      quantity: rawQuantity,
      unit,
      rate,
      vehicleNumber,
      vehicleType,
      driverName,
      billLocation,
    } = req.body;

    if (billId) {
      const existingBill = await ensureDraftBill(billId, vendorId);

      const updateData: Record<string, any> = {};

      if (vehicleNumber !== undefined) updateData.vehicleNumber = vehicleNumber;
      if (vehicleType !== undefined) updateData.vehicleType = vehicleType;
      if (driverName !== undefined) updateData.driverName = driverName;
      if (billLocation !== undefined) updateData.billLocation = billLocation;
      if (billDate !== undefined) updateData.billDate = new Date(billDate);

      const quantityChanged = rawQuantity !== undefined && unit !== undefined;
      const rateChanged = rate !== undefined;

      if (quantityChanged) {
        let quantity = rawQuantity;
        if (unit === "KG") {
          quantity = roundTo(quantity / 100, 4);
        } else if (unit === "MT") {
          quantity = roundTo(quantity * 10, 4);
        }

        const currentFarmerId = existingBill.farmerId;
        const lands = await prisma.farmerLand.findMany({
          where: { farmerId: currentFarmerId },
          select: { area: true },
        });
        const totalLandHectare = roundTo(
          lands.reduce((sum, land) => sum + (land.area ?? 0), 0),
          3,
        );
        if (totalLandHectare <= 0) {
          throw new AppError(
            "No valid land area found for this farmer. Please add farmer land first.",
            400,
          );
        }

        const usedQtyAgg = await prisma.bill.aggregate({
          where: {
            farmerId: currentFarmerId,
            status: { not: "CANCELLED" },
            id: { not: billId },
          },
          _sum: { primaryQuantity: true },
        });
        const alreadyUsedQtl = roundTo(
          usedQtyAgg._sum.primaryQuantity ?? 0,
          3,
        );
        const requestedQtl = roundTo(quantity, 3);
        const purchaseLimitPerHectare =
          await getPurchaseLimitQtlPerHectare();
        const allowedQtl = roundTo(
          totalLandHectare * purchaseLimitPerHectare,
          3,
        );
        const afterRequestQtl = roundTo(alreadyUsedQtl + requestedQtl, 3);
        const remainingBeforeRequestQtl = roundTo(
          allowedQtl - alreadyUsedQtl,
          3,
        );

        if (afterRequestQtl > allowedQtl) {
          throw new AppError(
            `Purchase limit exceeded. Allowed: ${allowedQtl} QTL, used: ${alreadyUsedQtl} QTL, remaining: ${Math.max(
              remainingBeforeRequestQtl,
              0,
            )} QTL, requested: ${requestedQtl} QTL.`,
            400,
          );
        }

        updateData.primaryQuantity = quantity;
        updateData.primaryUnit = "QTL";
      }

      if (rateChanged) {
        updateData.ratePerUnit = rate;
      }

      if (quantityChanged || rateChanged) {
        const qty = updateData.primaryQuantity ?? existingBill.primaryQuantity;
        const rt = updateData.ratePerUnit ?? existingBill.ratePerUnit;
        updateData.grossAmount = roundTo(qty * rt, 0);
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError("No fields to update", 400);
      }

      await prisma.bill.update({
        where: { id: billId },
        data: updateData,
      });

      const totals = await recalcTotals(billId);
      const hydrated = await prisma.bill.findUnique({
        where: { id: billId },
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
      successResponse(
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
          deductions: calculationDetails.variableDetails,
        },
        "Bill draft updated successfully",
      );
      return;
    }

    if (!farmerId || !rawQuantity || !unit || !rate || !vehicleNumber || !vehicleType || !driverName) {
      throw new AppError("farmerId, quantity, unit, rate, vehicleNumber, vehicleType, driverName are required for creating a new bill", 400);
    }

    let quantity = rawQuantity;
    if (unit === "KG") {
      quantity = roundTo(quantity / 100, 4);
    } else if (unit === "MT") {
      quantity = roundTo(quantity * 10, 4);
    }

    await checkFarmer(farmerId);

    const lands = await prisma.farmerLand.findMany({
      where: { farmerId },
      select: { area: true },
    });
    const totalLandHectare = roundTo(
      lands.reduce((sum, land) => sum + (land.area ?? 0), 0),
      3,
    );
    if (totalLandHectare <= 0) {
      throw new AppError(
        "No valid land area found for this farmer. Please add farmer land first.",
        400,
      );
    }

    const usedQtyAgg = await prisma.bill.aggregate({
      where: {
        farmerId,
        status: { not: "CANCELLED" },
      },
      _sum: { primaryQuantity: true },
    });
    const alreadyUsedQtl = roundTo(usedQtyAgg._sum.primaryQuantity ?? 0, 3);
    const requestedQtl = roundTo(quantity, 3);
    const purchaseLimitPerHectare = await getPurchaseLimitQtlPerHectare();
    const allowedQtl = roundTo(totalLandHectare * purchaseLimitPerHectare, 3);
    const afterRequestQtl = roundTo(alreadyUsedQtl + requestedQtl, 3);
    const remainingBeforeRequestQtl = roundTo(allowedQtl - alreadyUsedQtl, 3);

    if (afterRequestQtl > allowedQtl) {
      throw new AppError(
        `Purchase limit exceeded. Allowed: ${allowedQtl} QTL, used: ${alreadyUsedQtl} QTL, remaining: ${Math.max(
          remainingBeforeRequestQtl,
          0,
        )} QTL, requested: ${requestedQtl} QTL.`,
        400,
      );
    }

    const grossAmount = roundTo(quantity * rate, 0);

    const billNo = await generateBillNo();
    const draft = await prisma.bill.create({
      data: {
        billNo,
        billDate: billDate ? new Date(billDate) : new Date(),
        vendorId,
        farmerId,
        status: "DRAFT",
        primaryQuantity: quantity,
        primaryUnit: "QTL",
        ratePerUnit: rate,
        grossAmount,
        vehicleNumber,
        vehicleType,
        driverName,
        billLocation,
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
        deductions: calculationDetails.variableDetails,
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

          const unitHint = variableMeta.get(code)?.unitHint ?? "1";
          const measurementValue = customInputs[code];
          const referenceValue = actualInputs[code];
          deductedInputs[code] = calculateDeductedInput(
            code,
            unitHint,
            measurementValue,
            referenceValue,
          );
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
    const invalidTypeIds = requestedTypeIds.filter(
      (id) => !goniTypeMap.has(id),
    );
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

    const remark =
      typeof req.body?.remark === "string" && req.body.remark.trim()
        ? req.body.remark.trim()
        : undefined;
    let remarkUrl = undefined;

    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      const urls = await Promise.all(
        files.map((f) =>
          saveUploadedFile(f, "bills/remarks").then((u) => u.publicUrl),
        ),
      );
      remarkUrl = JSON.stringify(urls);
    }

    // Use transaction to update bill and create stock atomically
    await prisma.$transaction(async (tx) => {
      // Update bill status to PENDING
      await tx.bill.update({
        where: { id: billId },
        data: {
          status: "PENDING",
          remark,
          remarkUrl,
        },
      });

      await applyAdvanceAdjustmentOnBillConfirm(tx, billId, vendorId);

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

      const totalBags = trackedGonis.reduce((sum, g) => sum + g.bagCount, 0);
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
