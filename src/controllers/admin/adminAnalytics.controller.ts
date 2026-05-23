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

export const getLocationWiseStockSummary = async (
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

    const transfers = await prisma.stockTransfer.findMany({
      where: {
        status: { in: ["DISPATCHED", "RECEIVED", "DISCREPANCY", "COMPLETED"] },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: {
        sourceLocationId: true,
        destinationLocationId: true,
        weight: true,
        bagCount: true,
        dispatchedWeight: true,
        dispatchedBagCount: true,
        receivedWeight: true,
        receivedBagCount: true,
        sourceLocation: {
          select: { id: true, name: true, type: true },
        },
        destinationLocation: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    type LocAgg = {
      locationId: string;
      locationName: string;
      locationType: string;
      inboundWeightQtl: number;
      inboundBags: number;
      outboundWeightQtl: number;
      outboundBags: number;
    };

    const byLocation = new Map<string, LocAgg>();
    const upsert = (
      locationId: string,
      locationName: string,
      locationType: string,
    ) => {
      const existing = byLocation.get(locationId);
      if (existing) return existing;
      const created: LocAgg = {
        locationId,
        locationName,
        locationType,
        inboundWeightQtl: 0,
        inboundBags: 0,
        outboundWeightQtl: 0,
        outboundBags: 0,
      };
      byLocation.set(locationId, created);
      return created;
    };

    for (const transfer of transfers) {
      const outboundWeight = transfer.dispatchedWeight ?? transfer.weight ?? 0;
      const outboundBags = transfer.dispatchedBagCount ?? transfer.bagCount ?? 0;
      const inboundWeight = transfer.receivedWeight ?? outboundWeight;
      const inboundBags = transfer.receivedBagCount ?? outboundBags;

      if (transfer.sourceLocationId && transfer.sourceLocation) {
        const row = upsert(
          transfer.sourceLocationId,
          transfer.sourceLocation.name,
          transfer.sourceLocation.type,
        );
        row.outboundWeightQtl += outboundWeight;
        row.outboundBags += outboundBags;
      }

      if (transfer.destinationLocationId && transfer.destinationLocation) {
        const row = upsert(
          transfer.destinationLocationId,
          transfer.destinationLocation.name,
          transfer.destinationLocation.type,
        );
        row.inboundWeightQtl += inboundWeight;
        row.inboundBags += inboundBags;
      }
    }

    const locations = Array.from(byLocation.values()).map((row) => ({
      ...row,
      netWeightQtl: roundTo(row.inboundWeightQtl - row.outboundWeightQtl, 3),
      netBags: row.inboundBags - row.outboundBags,
    }));

    const totals = locations.reduce(
      (acc, row) => {
        acc.inboundWeightQtl += row.inboundWeightQtl;
        acc.outboundWeightQtl += row.outboundWeightQtl;
        acc.inboundBags += row.inboundBags;
        acc.outboundBags += row.outboundBags;
        return acc;
      },
      {
        inboundWeightQtl: 0,
        outboundWeightQtl: 0,
        inboundBags: 0,
        outboundBags: 0,
      },
    );

    successResponse(
      res,
      {
        totals: {
          ...totals,
          netWeightQtl: roundTo(
            totals.inboundWeightQtl - totals.outboundWeightQtl,
            3,
          ),
          netBags: totals.inboundBags - totals.outboundBags,
        },
        locations,
      },
      "Location-wise stock summary fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const getLocationLedger = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { startDate, endDate, locationId } = req.query as {
      startDate?: string;
      endDate?: string;
      locationId?: string;
    };
    const dateFilter = buildDateFilter(startDate, endDate);

    const transfers = await prisma.stockTransfer.findMany({
      where: {
        status: { in: ["DISPATCHED", "RECEIVED", "DISCREPANCY"] },
        ...(dateFilter && { createdAt: dateFilter }),
        ...(locationId && {
          OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }],
        }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        transferNo: true,
        status: true,
        createdAt: true,
        dispatchedAt: true,
        receivedAt: true,
        sourceLocationId: true,
        destinationLocationId: true,
        dispatchedWeight: true,
        dispatchedBagCount: true,
        receivedWeight: true,
        receivedBagCount: true,
        weightShortage: true,
        bagShortage: true,
        sourceLocation: { select: { id: true, name: true, type: true } },
        destinationLocation: { select: { id: true, name: true, type: true } },
      },
    });

    const rows = transfers.map((t) => ({
      transferId: t.id,
      transferNo: t.transferNo,
      status: t.status,
      createdAt: t.createdAt,
      dispatchedAt: t.dispatchedAt,
      receivedAt: t.receivedAt,
      source: t.sourceLocation,
      destination: t.destinationLocation,
      dispatchedWeightQtl: roundTo(t.dispatchedWeight ?? 0, 3),
      dispatchedBags: t.dispatchedBagCount ?? 0,
      receivedWeightQtl: roundTo(t.receivedWeight ?? 0, 3),
      receivedBags: t.receivedBagCount ?? 0,
      weightShortageQtl: roundTo(t.weightShortage ?? 0, 3),
      bagShortage: t.bagShortage ?? 0,
    }));

    successResponse(res, rows, "Location ledger fetched");
  } catch (error) {
    next(error);
  }
};
