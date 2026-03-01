import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../core/appError";
import { generateBillNo } from "../../utils/billNo";
import { checkFarmer } from "../../repositories/checkFarmer.repository";
import { formulaEngine } from "../../services/formulaEngine.service";
import { roundTo } from "../../utils/number";
import { attachDeductionDetails } from "../../utils/deductionDetails";

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

const withGoniAmount = (bill: any) => {
  const goniWeight = bill?.goniWeight ?? 0;
  const ratePerUnit = bill?.ratePerUnit ?? 0;
  const goniDeductionAmount = roundTo(goniWeight * ratePerUnit);
  return { ...bill, goniDeductionAmount };
};

const ensureDraftBill = async (billId: string, vendorId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { deductions: true, goniType: true },
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
    include: { deductions: true },
  });
  if (!bill) throw new AppError("Bill not found while recalculating", 404);
  const deductionTotal = bill.deductions.reduce((sum, d) => sum + d.value, 0);
  const gross = bill.grossAmount ?? 0;
  const goniWeight = bill.goniWeight ?? 0;
  const ratePerUnit = bill.ratePerUnit ?? 0;
  const goniDeductionAmount = roundTo(goniWeight * ratePerUnit);
  const netPayable = roundTo(
    Math.max(gross - deductionTotal - goniDeductionAmount, 0),
    2,
  );

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
    goniWeight,
    goniDeductionAmount,
    netPayable,
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
      quantity,
      unit,
      rate,
      vehicleNumber,
      vehicleType,
      driverName,
    } = req.body;

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
        primaryUnit: unit,
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
      include: { farmer: true, deductions: true, goniType: true },
    });

    const billWithGoni = withGoniAmount(hydrated);
    createdResponse(
      res,
      { bill: billWithGoni, totals },
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
    debugger;
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
          const unitFactor = parseUnitHint(unitHint);
          deductedInputs[code] = roundTo(rawExtra * unitFactor);
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
        const grossAmount = bill.grossAmount ?? 0;
        value = roundTo((grossAmount * safeTotalPercent) / 100);

        for (const code of Object.keys(deductedInputs)) {
          const percent = deductedInputs[code] ?? 0;
          deductedAmounts[code] = roundTo((grossAmount * percent) / 100);
        }

        payload.deductedAmounts = deductedAmounts;

        variableDetails = (master.variables || []).map((variable) => ({
          code: variable.code,
          label: variable.label,
          unitHint: variable.unitHint,
          actual: actualInputs?.[variable.code] ?? 0,
          custom: customInputs?.[variable.code] ?? 0,
          deducted: deductedInputs?.[variable.code] ?? 0,
          deductionValue: deductedAmounts?.[variable.code] ?? 0,
        }));
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

    successResponse(
      res,
      {
        totals,
        deductions: deductionDetails,
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

    const { goniTypeId, bagCount } = req.body;
    const goniType = await prisma.goniType.findFirst({
      where: { id: goniTypeId, isActive: true },
    });
    if (!goniType) throw new AppError("Goni type not found", 404);

    const goniWeight = roundTo(bagCount * goniType.weightPerBag, 3);

    await prisma.bill.update({
      where: { id: billId },
      data: {
        goniTypeId,
        bagCount,
        goniWeight,
      },
    });

    const totals = await recalcTotals(billId);

    successResponse(res, { goniWeight, totals }, "Goni deduction applied");
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
    const totals = await recalcTotals(billId);

    const response = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        farmer: true,
        deductions: true,
        goniType: true,
      },
    });

    const billWithDetails = attachDeductionDetails(response);
    const billWithGoni = withGoniAmount(billWithDetails);
    successResponse(res, { bill: billWithGoni, totals }, "Bill preview");
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

      // Auto-create stock entry for vendor
      await tx.stock.create({
        data: {
          vendorId,
          billId,
          weight: bill.primaryQuantity!,
          unit: bill.primaryUnit!,
          bagCount: bill.bagCount ?? 0,
          goniTypeId: bill.goniTypeId,
          status: "AVAILABLE",
        },
      });
    });

    successResponse(res, null, "Bill confirmed and stock added");
  } catch (error) {
    next(error);
  }
};
