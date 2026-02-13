import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../core/appError";
import { generateBillNo } from "../../utils/billNo";
import { checkFarmer } from "../../repositories/checkFarmer.repository";
import { formulaEngine } from "../../services/formulaEngine.service";
import { roundTo } from "../../utils/number";

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
  const net = roundTo(Math.max(gross - deductionTotal - goniWeight, 0));

  await prisma.bill.update({
    where: { id: billId },
    data: {
      totalAmount: net,
      netPayable: net,
    },
  });

  return {
    grossAmount: gross,
    totalDeductions: deductionTotal,
    goniWeight,
    netPayable: net,
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
    const { farmerId, billDate, quantity, unit, rate } = req.body;

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
        totalAmount: grossAmount,
        netPayable: grossAmount,
      },
    });
    const totals = await recalcTotals(draft.id);
    const hydrated = await prisma.bill.findUnique({
      where: { id: draft.id },
      include: { farmer: true, deductions: true, goniType: true },
    });

    createdResponse(
      res,
      { bill: hydrated, totals },
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
    await ensureDraftBill(billId, vendorId);

    const { deductions } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.billDeduction.deleteMany({ where: { billId } });

      for (const deduction of deductions) {
        const master = await tx.deductionMaster.findFirst({
          where: { id: deduction.masterId, isActive: true },
          include: { variables: true },
        });

        if (!master) {
          throw new AppError("Deduction master not found or inactive", 404);
        }

        let value = 0;
        let payload: Record<string, number> | undefined;

        if (master.type === "FIXED") {
          value = master.baseAmount ?? 0;
        } else {
          const inputs = deduction.inputs || {};
          for (const variable of master.variables) {
            if (typeof inputs[variable.code] !== "number") {
              throw new AppError(`Missing input for ${variable.code}`, 400);
            }
          }
          payload = inputs;
          value = formulaEngine.evaluate(
            master.formulaExpression || "",
            inputs,
          );
        }

        await tx.billDeduction.create({
          data: {
            billId,
            masterId: master.id,
            label: master.name,
            value,
            payload,
          },
        });
      }
    });

    const totals = await recalcTotals(billId);

    successResponse(res, totals, "Deductions recalculated");
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
    const bill = await ensureDraftBill(billId, vendorId);
    const totals = await recalcTotals(billId);

    const response = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        farmer: true,
        deductions: true,
        goniType: true,
      },
    });

    successResponse(res, { bill: response, totals }, "Bill preview");
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

    await prisma.bill.update({
      where: { id: billId },
      data: {
        status: "PENDING",
      },
    });

    successResponse(res, null, "Bill confirmed");
  } catch (error) {
    next(error);
  }
};
