import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { successResponse, createdResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { generateTransferNo } from "../utils/transferNo";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getVendorCurrentBagsForType,
  isTrackedGoniType,
} from "../services/bagLedger.service";
import { toQtl } from "../utils/quantity";

// =====================
// VENDOR TRANSFER OPERATIONS
// =====================

/**
 * Create transfer request (Vendor -> Admin)
 * Supports both single bag type and multiple bag types via items[].
 */
export const createTransfer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const {
      weight,
      unit,
      bagCount,
      goniTypeId,
      items,
      sourceLocationId,
      destinationLocationId,
      vehicalNumber,
    } = req.body as {
      weight?: number;
      unit?: "QTL" | "MT";
      bagCount?: number;
      goniTypeId?: string;
      items?: Array<{ goniTypeId: string; bagCount: number }>;
      sourceLocationId: string;
      destinationLocationId: string;
      vehicalNumber: string;
    };

    const normalizedItems =
      Array.isArray(items) && items.length
        ? items
        : goniTypeId && typeof bagCount === "number"
          ? [{ goniTypeId, bagCount }]
          : [];

    if (!normalizedItems.length) {
      throw new AppError(
        "Provide either items[] for multi-type transfer or goniTypeId + bagCount for single type",
        400,
      );
    }

    const bagCountByType = new Map<string, number>();
    for (const item of normalizedItems) {
      const current = bagCountByType.get(item.goniTypeId) ?? 0;
      bagCountByType.set(item.goniTypeId, current + item.bagCount);
    }

    const transferItems = Array.from(bagCountByType.entries()).map(
      ([typeId, totalBags]) => ({
        goniTypeId: typeId,
        bagCount: totalBags,
      }),
    );
    const totalBagCount = transferItems.reduce(
      (sum, item) => sum + item.bagCount,
      0,
    );
    const normalizedWeightQtl =
      typeof weight === "number" ? toQtl(weight, unit ?? "QTL") : undefined;

    // Get vendor's total available stock
    const availableStock = await prisma.stock.aggregate({
      where: {
        vendorId,
        status: "AVAILABLE",
      },
      _sum: {
        weight: true,
        bagCount: true,
      },
    });

    const availableWeight = availableStock._sum.weight || 0;
    const availableBags = availableStock._sum.bagCount || 0;

    // Validate transfer doesn't exceed available stock
    if (
      typeof normalizedWeightQtl === "number" &&
      normalizedWeightQtl > availableWeight
    ) {
      throw new AppError(
        `Transfer weight exceeds available stock (${availableWeight} QTL)`,
        400,
      );
    }

    if (totalBagCount > availableBags) {
      throw new AppError(
        `Transfer bag count (${totalBagCount}) exceeds available stock (${availableBags})`,
        400,
      );
    }

    // Validate goni types
    const goniTypes = await prisma.goniType.findMany({
      where: {
        id: { in: transferItems.map((item) => item.goniTypeId) },
        isActive: true,
      },
      select: { id: true, name: true, isTracked: true },
    });

    const goniTypeMap = new Map(goniTypes.map((type) => [type.id, type]));
    const invalidTypeIds = transferItems
      .map((item) => item.goniTypeId)
      .filter((id) => !goniTypeMap.has(id));

    if (invalidTypeIds.length) {
      throw new AppError(
        `Goni type not found or inactive: ${invalidTypeIds.join(", ")}`,
        404,
      );
    }

    // Apply tracked-bag availability check only for tracked types
    for (const item of transferItems) {
      const currentType = goniTypeMap.get(item.goniTypeId)!;
      if (!currentType.isTracked) continue;

      const availableBagsByType = await getVendorCurrentBagsForType(
        vendorId,
        item.goniTypeId,
      );

      if (item.bagCount > availableBagsByType) {
        throw new AppError(
          `Transfer bag count (${item.bagCount}) exceeds available ${currentType.name} bags (${availableBagsByType})`,
          400,
        );
      }
    }

    const [sourceLocation, destinationLocation] = await Promise.all([
      prisma.inventoryLocation.findFirst({
        where: { id: sourceLocationId, isActive: true },
        select: { id: true },
      }),
      prisma.inventoryLocation.findFirst({
        where: { id: destinationLocationId, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!sourceLocation || !destinationLocation) {
      throw new AppError("Invalid or inactive source/destination location", 400);
    }

    if (sourceLocationId === destinationLocationId) {
      throw new AppError(
        "Source and destination locations must be different",
        400,
      );
    }

    const transferNo = await generateTransferNo();

    const transfer = await prisma.$transaction(async (tx) => {
      const createdTransfer = await tx.stockTransfer.create({
        data: {
          transferNo,
          vendorId,
          goniTypeId:
            transferItems.length === 1 ? transferItems[0].goniTypeId : null,
          vendorEnteredWeight: weight,
          vendorEnteredUnit: unit,
          weight: normalizedWeightQtl,
          unit: "QTL",
          bagCount: totalBagCount,
          sourceLocationId,
          destinationLocationId,
          vehicalNumber,
          status: "PENDING",
        },
      });

      await tx.stockTransferItem.createMany({
        data: transferItems.map((item) => ({
          transferId: createdTransfer.id,
          goniTypeId: item.goniTypeId,
          bagCount: item.bagCount,
        })),
      });

      return tx.stockTransfer.findUnique({
        where: { id: createdTransfer.id },
        include: {
          vendor: {
            select: { id: true, name: true, phone: true },
          },
          goniType: true,
          items: {
            include: { goniType: true },
          },
          sourceLocation: true,
          destinationLocation: true,
        },
      });
    });

    createdResponse(res, transfer, "Transfer request created successfully");
  } catch (error) {
    console.error("Error creating transfer:", error);
    next(error);
  }
};

/**
 * Get vendor's transfer requests
 */
export const getVendorTransfers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { status, page = 1, limit = 20 } = req.query;

    const where: any = { vendorId };
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          goniType: true,
          items: {
            include: { goniType: true },
          },
          sourceLocation: true,
          destinationLocation: true,
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    successResponse(
      res,
      {
        transfers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Transfers fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

// =====================
// ADMIN TRANSFER OPERATIONS
// =====================

/**
 * Get all transfers (Admin)
 */
export const getAdminTransfers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          vendor: {
            select: { id: true, name: true, phone: true },
          },
          goniType: true,
          items: {
            include: { goniType: true },
          },
          sourceLocation: true,
          destinationLocation: true,
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    successResponse(
      res,
      {
        transfers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Transfers fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Complete transfer (Admin) - Deducts from vendor's available stock using FIFO
 */
export const completeTransfer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { transferId } = req.params;

    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        status: "PENDING",
      },
      include: {
        items: true,
      },
    });

    if (!transfer) {
      throw new AppError("Transfer not found or already processed", 404);
    }

    // Get vendor's available stocks ordered by createdAt (FIFO)
    const availableStocks = await prisma.stock.findMany({
      where: {
        vendorId: transfer.vendorId,
        status: "AVAILABLE",
      },
      orderBy: { createdAt: "asc" },
    });

    let remainingWeight = transfer.weight || 0;
    let remainingBags = transfer.bagCount || 0;

    if (remainingWeight <= 0 && remainingBags <= 0) {
      throw new AppError("Transfer has no weight or bag count to process", 400);
    }

    // Check if enough stock is available
    const totalAvailableWeight = availableStocks.reduce(
      (sum, s) => sum + s.weight,
      0,
    );
    const totalAvailableBags = availableStocks.reduce(
      (sum, s) => sum + s.bagCount,
      0,
    );

    if (
      remainingWeight > totalAvailableWeight ||
      remainingBags > totalAvailableBags
    ) {
      throw new AppError("Insufficient stock available for this transfer", 400);
    }

    await prisma.$transaction(async (tx) => {
      // Deduct from stocks using FIFO
      for (const stock of availableStocks) {
        if (remainingWeight <= 0 && remainingBags <= 0) break;

        const deductWeight = Math.min(
          stock.weight,
          Math.max(remainingWeight, 0),
        );
        const deductBags = Math.min(stock.bagCount, Math.max(remainingBags, 0));

        const newWeight = stock.weight - deductWeight;
        const newBags = stock.bagCount - deductBags;

        if (newWeight <= 0 && newBags <= 0) {
          // Fully transferred
          await tx.stock.update({
            where: { id: stock.id },
            data: { status: "TRANSFERRED", weight: 0, bagCount: 0 },
          });
        } else {
          // Partially transferred
          await tx.stock.update({
            where: { id: stock.id },
            data: { weight: newWeight, bagCount: newBags },
          });
        }

        remainingWeight -= deductWeight;
        remainingBags -= deductBags;
      }

      // Update transfer status
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      const transferItemsForLedger =
        transfer.items.length > 0
          ? transfer.items
          : transfer.goniTypeId
            ? [
                {
                  goniTypeId: transfer.goniTypeId,
                  bagCount: transfer.bagCount,
                },
              ]
            : [];

      const trackedItems: Array<{ goniTypeId: string; bagCount: number }> = [];
      for (const item of transferItemsForLedger) {
        if (await isTrackedGoniType(item.goniTypeId)) {
          trackedItems.push({
            goniTypeId: item.goniTypeId,
            bagCount: item.bagCount,
          });
        }
      }

      if (trackedItems.length) {
        await tx.bagMovement.createMany({
          data: trackedItems.map((item) => ({
            vendorId: transfer.vendorId,
            goniTypeId: item.goniTypeId,
            transferId: transfer.id,
            bagCount: item.bagCount,
            movementType: "VENDOR_TO_ADMIN",
            createdById: req.user?.id,
          })),
        });
      }
    });

    successResponse(res, null, "Transfer completed successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Update transfer (Admin) - allows updating only weight and unit for pending transfers
 */
export const updateTransfer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { transferId } = req.params;
    const { weight, unit } = req.body;

    if (weight === undefined && unit === undefined) {
      throw new AppError(
        "At least one field (weight or unit) is required",
        400,
      );
    }

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new AppError("Transfer not found", 404);
    }

    if (transfer.status !== "PENDING") {
      throw new AppError("Only pending transfers can be updated", 400);
    }

    if (unit !== undefined && weight === undefined) {
      throw new AppError(
        "Weight is required when updating unit to avoid ambiguous conversion",
        400,
      );
    }

    const now = new Date();
    const updateData: any = {};

    if (weight !== undefined) {
      const normalizedWeightQtl = toQtl(
        weight,
        (unit ?? transfer.unit ?? "QTL") as "QTL" | "MT",
      );
      updateData.weight = normalizedWeightQtl;
      updateData.unit = "QTL";
      updateData.adminAdjustedWeight = weight;
      updateData.vendorEnteredWeight = transfer.vendorEnteredWeight ?? null;
      updateData.adminAdjustedAt = now;
    }

    if (unit !== undefined) {
      updateData.adminAdjustedUnit = unit;
      updateData.vendorEnteredUnit =
        transfer.vendorEnteredUnit ?? transfer.unit;
      updateData.adminAdjustedAt = now;
    }

    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: updateData,
      include: {
        vendor: {
          select: { id: true, name: true, phone: true },
        },
        goniType: true,
        items: {
          include: { goniType: true },
        },
        sourceLocation: true,
        destinationLocation: true,
      },
    });

    successResponse(res, updatedTransfer, "Transfer updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin stock summary - total received from all vendors
 */
export const getAdminStockSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Total completed transfers
    const totalReceived = await prisma.stockTransfer.aggregate({
      where: { status: "COMPLETED" },
      _sum: {
        weight: true,
        bagCount: true,
      },
      _count: true,
    });

    // Pending transfers
    const pendingTransfers = await prisma.stockTransfer.aggregate({
      where: { status: "PENDING" },
      _sum: {
        weight: true,
        bagCount: true,
      },
      _count: true,
    });

    // By vendor
    const byVendor = await prisma.stockTransfer.groupBy({
      by: ["vendorId"],
      where: { status: "COMPLETED" },
      _sum: {
        weight: true,
        bagCount: true,
      },
      _count: true,
    });

    const vendorIds = byVendor.map((v) => v.vendorId);
    const vendors = await prisma.user.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true, phone: true },
    });

    const byVendorWithDetails = byVendor.map((v) => ({
      ...v,
      vendor: vendors.find((vendor) => vendor.id === v.vendorId),
    }));

    const completedTransfersForAnalysis = await prisma.stockTransfer.findMany({
      where: { status: "COMPLETED" },
      select: {
        vendorEnteredWeight: true,
        vendorEnteredUnit: true,
        adminAdjustedWeight: true,
        adminAdjustedUnit: true,
        weight: true,
      },
    });

    const analysis = completedTransfersForAnalysis.reduce(
      (acc, transfer) => {
        const vendorWeight =
          transfer.vendorEnteredWeight !== null &&
          transfer.vendorEnteredWeight !== undefined
            ? toQtl(
                transfer.vendorEnteredWeight,
                transfer.vendorEnteredUnit ?? "QTL",
              )
            : (transfer.weight ?? 0);
        const adminWeight =
          transfer.adminAdjustedWeight !== null &&
          transfer.adminAdjustedWeight !== undefined
            ? toQtl(
                transfer.adminAdjustedWeight,
                transfer.adminAdjustedUnit ?? "QTL",
              )
            : (transfer.weight ?? 0);

        acc.vendorEnteredWeight += vendorWeight;
        acc.adminAdjustedWeight += adminWeight;
        acc.totalAdjustment += adminWeight - vendorWeight;
        return acc;
      },
      {
        vendorEnteredWeight: 0,
        adminAdjustedWeight: 0,
        totalAdjustment: 0,
      },
    );

    successResponse(
      res,
      {
        totalReceived: {
          weight: totalReceived._sum.weight || 0,
          bagCount: totalReceived._sum.bagCount || 0,
          transfers: totalReceived._count,
        },
        pendingTransfers: {
          weight: pendingTransfers._sum.weight || 0,
          bagCount: pendingTransfers._sum.bagCount || 0,
          count: pendingTransfers._count,
        },
        analysis,
        byVendor: byVendorWithDetails,
      },
      "Admin stock summary fetched",
    );
  } catch (error) {
    next(error);
  }
};
