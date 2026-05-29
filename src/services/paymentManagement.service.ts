import { AdvanceReason, AdvanceSource, AdvanceTxnType, Prisma } from "@prisma/client";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { roundTo } from "../utils/number";

type TxClient = Prisma.TransactionClient;

const signedAmount = (amount: number, txnType: AdvanceTxnType) => {
  if (txnType === "CREDIT") return amount;
  if (txnType === "REVERSAL") return -amount;
  return -amount;
};

const sumAdvanceBalance = (rows: Array<{ amount: number; txnType: AdvanceTxnType }>) =>
  roundTo(rows.reduce((sum, row) => sum + signedAmount(row.amount, row.txnType), 0));

export const getFarmerAdvanceBalance = async (farmerId: string) => {
  const rows = await prisma.farmerAdvance.findMany({
    where: { farmerId },
    select: { amount: true, txnType: true },
  });
  return sumAdvanceBalance(rows);
};

export const createProfileAdvance = async (params: {
  farmerId: string;
  amount: number;
  reason: AdvanceReason;
  remarks?: string;
  createdById: string;
  source?: AdvanceSource;
  billId?: string;
}) => {
  const source = params.source ?? "PROFILE";
  if (params.amount <= 0) {
    throw new AppError("Advance amount must be greater than 0", 400);
  }

  return prisma.farmerAdvance.create({
    data: {
      farmerId: params.farmerId,
      billId: params.billId,
      amount: roundTo(params.amount),
      txnType: "CREDIT",
      source,
      reason: params.reason,
      remarks: params.remarks,
      createdById: params.createdById,
    },
  });
};

export const applyAdvanceAdjustmentOnBillConfirm = async (
  tx: TxClient,
  billId: string,
  actorId: string,
) => {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
  });
  if (!bill) throw new AppError("Bill not found", 404);

  const existingAdjustment = await tx.farmerAdvance.findFirst({
    where: {
      billId,
      txnType: "ADJUSTMENT",
    },
  });

  // Idempotency guard: when confirm is retried do not apply advance twice.
  if (existingAdjustment) {
    return existingAdjustment.amount;
  }

  const farmerRows = await tx.farmerAdvance.findMany({
    where: { farmerId: bill.farmerId },
    select: { amount: true, txnType: true },
  });
  const balance = sumAdvanceBalance(farmerRows);
  const billAmount = roundTo(Number(bill.totalAmount ?? 0));
  const adjustment = roundTo(Math.min(balance, billAmount));

  if (adjustment <= 0) {
    await tx.bill.update({
      where: { id: billId },
      data: {
        status: billAmount <= 0 ? "COMPLETED" : "PENDING",
      },
    });
    return 0;
  }

  await tx.farmerAdvance.create({
    data: {
      farmerId: bill.farmerId,
      billId: bill.id,
      amount: adjustment,
      txnType: "ADJUSTMENT",
      source: "PROFILE",
      reason: "OTHER",
      remarks: `Auto-adjusted on bill confirm (${bill.billNo})`,
      createdById: actorId,
    },
  });

  await tx.bill.update({
    where: { id: billId },
    data: {
      status: adjustment >= billAmount ? "COMPLETED" : "PENDING",
    },
  });

  return adjustment;
};

export const getBillSettlementSummary = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
  });
  if (!bill) throw new AppError("Bill not found", 404);

  const adjustments = await prisma.farmerAdvance.aggregate({
    where: { billId, txnType: "ADJUSTMENT" },
    _sum: { amount: true },
  });
  const settlements = await prisma.billSettlement.aggregate({
    where: { billId },
    _sum: { amount: true },
  });
  const settledAmount = roundTo(Number(settlements._sum.amount ?? 0));
  const adjustedAdvanceAmount = roundTo(Number(adjustments._sum.amount ?? 0));
  const baseAmount = roundTo(Number(bill.totalAmount ?? 0));
  const pendingAmount = roundTo(
    Math.max(baseAmount - adjustedAdvanceAmount - settledAmount, 0),
  );

  return {
    bill,
    baseAmount,
    adjustedAdvanceAmount,
    settledAmount,
    pendingAmount,
  };
};

export const getBillFinancialMap = async (billIds: string[]) => {
  if (!billIds.length) return new Map<string, { adjustedAdvanceAmount: number; settledAmount: number; pendingAmount: number }>();

  const [adjustments, settlements, bills] = await Promise.all([
    prisma.farmerAdvance.groupBy({
      by: ["billId"],
      where: { billId: { in: billIds }, txnType: "ADJUSTMENT" },
      _sum: { amount: true },
    }),
    prisma.billSettlement.groupBy({
      by: ["billId"],
      where: { billId: { in: billIds } },
      _sum: { amount: true },
    }),
    prisma.bill.findMany({
      where: { id: { in: billIds } },
      select: { id: true, totalAmount: true },
    }),
  ]);

  const adjustmentMap = new Map(
    adjustments
      .filter((row) => !!row.billId)
      .map((row) => [row.billId as string, roundTo(Number(row._sum.amount ?? 0))]),
  );
  const settlementMap = new Map(
    settlements
      .filter((row) => !!row.billId)
      .map((row) => [row.billId as string, roundTo(Number(row._sum.amount ?? 0))]),
  );

  const result = new Map<string, { adjustedAdvanceAmount: number; settledAmount: number; pendingAmount: number }>();
  for (const bill of bills) {
    const adjustedAdvanceAmount = adjustmentMap.get(bill.id) ?? 0;
    const settledAmount = settlementMap.get(bill.id) ?? 0;
    const pendingAmount = roundTo(
      Math.max(roundTo(Number(bill.totalAmount ?? 0)) - adjustedAdvanceAmount - settledAmount, 0),
    );
    result.set(bill.id, { adjustedAdvanceAmount, settledAmount, pendingAmount });
  }
  return result;
};

export const createBillSettlement = async (params: {
  billId: string;
  amount: number;
  paidDate?: string;
  reference?: string;
  remarks?: string;
  createdById: string;
}) => {
  if (params.amount <= 0) {
    throw new AppError("Payment amount must be greater than 0", 400);
  }

  const summaryBefore = await getBillSettlementSummary(params.billId);
  if (summaryBefore.bill.status === "DRAFT" || summaryBefore.bill.status === "CANCELLED") {
    throw new AppError("Bill not ready for payment", 400);
  }
  if (params.amount > summaryBefore.pendingAmount) {
    throw new AppError(
      `Payment amount cannot exceed remaining amount (${summaryBefore.pendingAmount})`,
      400,
    );
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const createdSettlement = await tx.billSettlement.create({
      data: {
        billId: summaryBefore.bill.id,
        farmerId: summaryBefore.bill.farmerId,
        amount: roundTo(params.amount),
        paidDate: params.paidDate ? new Date(params.paidDate) : new Date(),
        reference: params.reference,
        remarks: params.remarks,
        createdById: params.createdById,
      },
    });

    const aggregate = await tx.billSettlement.aggregate({
      where: { billId: summaryBefore.bill.id },
      _sum: { amount: true },
    });
    const settledAmount = roundTo(Number(aggregate._sum.amount ?? 0));
    const payableBase = roundTo(Number(summaryBefore.bill.totalAmount ?? 0));
    const adjustedAdvanceAmount = summaryBefore.adjustedAdvanceAmount;
    const pendingAmount = roundTo(
      Math.max(payableBase - adjustedAdvanceAmount - settledAmount, 0),
    );
    const isFullyPaid = pendingAmount <= 0;

    await tx.bill.update({
      where: { id: summaryBefore.bill.id },
      data: {
        status: isFullyPaid ? "COMPLETED" : "PENDING",
      },
    });

    const cumulativePaid = roundTo(adjustedAdvanceAmount + settledAmount);
    const paymentStatus = isFullyPaid ? "PAID" : "PENDING";
    const existing = await tx.farmerPayment.findUnique({
      where: { billId: summaryBefore.bill.id },
    });
    if (existing) {
      await tx.farmerPayment.update({
        where: { billId: summaryBefore.bill.id },
        data: {
          amount: cumulativePaid,
          status: paymentStatus,
          paidDate: params.paidDate ? new Date(params.paidDate) : new Date(),
          reference: params.reference,
        },
      });
    } else {
      await tx.farmerPayment.create({
        data: {
          billId: summaryBefore.bill.id,
          farmerId: summaryBefore.bill.farmerId,
          amount: cumulativePaid,
          status: paymentStatus,
          paidDate: params.paidDate ? new Date(params.paidDate) : new Date(),
          reference: params.reference,
        },
      });
    }

    await tx.paymentActivity.create({
      data: {
        billId: summaryBefore.bill.id,
        farmerId: summaryBefore.bill.farmerId,
        oldStatus: existing?.status ?? null,
        newStatus: paymentStatus,
        remarks: params.remarks ?? null,
        createdById: params.createdById,
      },
    });

    return {
      createdSettlement,
      settledAmount,
      adjustedAdvanceAmount,
      pendingAmount,
      totalAmount: payableBase,
      isFullyPaid,
    };
  });

  return settlement;
};
