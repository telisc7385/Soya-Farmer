import { Request, Response, NextFunction } from "express";
import { Prisma, QuantityUnit } from "@prisma/client";
import prisma from "../../database/prisma";
import { successResponse } from "../../utils/response";
import { roundTo } from "../../utils/number";

const buildDateFilter = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  return filter;
};

const toMt = (weight?: number | null, unit?: QuantityUnit | null) => {
  if (!weight) return 0;
  if (unit === "QTL") return weight / 10;
  return weight;
};

export const getAdminDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };
    const dateFilter = buildDateFilter(startDate, endDate);

    const vendorBaseWhere: Prisma.UserWhereInput = {
      role: "VENDOR" as const,
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const billWhere: Prisma.BillWhereInput = {
      status: { in: ["PENDING", "COMPLETED"] },
      ...(dateFilter && { billDate: dateFilter }),
    };

    const transferWhere: Prisma.StockTransferWhereInput = {
      status: { in: ["RECEIVED", "DISCREPANCY", "COMPLETED"] },
      ...(dateFilter && { completedAt: dateFilter }),
    };

    const [
      totalVendors,
      activeVendors,
      inactiveVendors,
      billTotals,
      bagTotals,
      transfers,
    ] = await Promise.all([
      prisma.user.count({ where: vendorBaseWhere }),
      prisma.user.count({ where: { ...vendorBaseWhere, isActive: true } }),
      prisma.user.count({ where: { ...vendorBaseWhere, isActive: false } }),
      prisma.bill.aggregate({
        where: billWhere,
        _sum: {
          primaryQuantity: true,
        },
      }),
      prisma.billGoni.aggregate({
        where: {
          bill: { is: billWhere },
        },
        _sum: {
          bagCount: true,
        },
      }),
      prisma.stockTransfer.findMany({
        where: transferWhere,
        select: {
          weight: true,
          receivedWeight: true,
          unit: true,
          bagCount: true,
          receivedBagCount: true,
        },
      }),
    ]);

    const totalWeightQtl = billTotals._sum.primaryQuantity ?? 0;
    const weightReceivedMt = roundTo(totalWeightQtl / 10);
    const bagsReceived = bagTotals._sum.bagCount ?? 0;

    const transferred = transfers.reduce(
      (acc, row) => {
        acc.weightMt += toMt(row.receivedWeight ?? row.weight, row.unit);
        acc.bags += row.receivedBagCount ?? row.bagCount ?? 0;
        return acc;
      },
      { weightMt: 0, bags: 0 },
    );

    successResponse(
      res,
      {
        registered_vendors: {
          total: totalVendors,
          active: activeVendors,
          inactive: inactiveVendors,
        },
        weight_received_mt: roundTo(weightReceivedMt),
        bags_received: bagsReceived,
        transferred_stock_mt: roundTo(transferred.weightMt),
        bags_transferred: transferred.bags,
      },
      "Admin dashboard summary fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const getVendorTrends = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };
    const dateFilter = buildDateFilter(startDate, endDate);

    const billWhere: Prisma.BillWhereInput = {
      status: { in: ["PENDING", "COMPLETED"] },
      ...(dateFilter && { billDate: dateFilter }),
    };

    const grouped = await prisma.bill.groupBy({
      by: ["vendorId"],
      where: billWhere,
      _count: { _all: true },
      _sum: {
        primaryQuantity: true,
        totalAmount: true,
        ratePerUnit: true,
      },
    });

    const vendorIds = grouped.map((row) => row.vendorId);
    const vendors = vendorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true },
        })
      : [];

    const data = grouped.map((row) => {
      const totalBills = row._count._all ?? 0;
      const totalRate = row._sum.ratePerUnit ?? 0;
      const avgRate =
        totalBills > 0 ? roundTo(totalRate / totalBills, 2) : 0;

      return {
        vendor_id: row.vendorId,
        vendor_name: vendors.find((v) => v.id === row.vendorId)?.name ?? "",
        total_bills: totalBills,
        total_quantity: roundTo(row._sum.primaryQuantity ?? 0, 3),
        total_amount: roundTo(row._sum.totalAmount ?? 0),
        average_rate: avgRate,
      };
    });

    successResponse(res, data, "Vendor trends fetched");
  } catch (error) {
    next(error);
  }
};
