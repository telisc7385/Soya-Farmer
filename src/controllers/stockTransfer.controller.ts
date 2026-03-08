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

// =====================
// VENDOR TRANSFER OPERATIONS
// =====================

/**
 * Create transfer request (Vendor → Admin)
 * Vendor transfers from their total available stock
 */
export const createTransfer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { weight, unit, bagCount, goniTypeId, shopName, shopLocation, vehicalNumber } =
      req.body as {
        weight?: number;
        unit?: "QTL" | "MT";
        bagCount: number;
        goniTypeId: string;
        shopName: string;
        shopLocation: string;
        vehicalNumber: string;
      };

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
    if (typeof weight === "number" && weight > availableWeight) {
      throw new AppError(
        `Transfer weight (${weight}) exceeds available stock (${availableWeight})`,
        400,
      );
    }

    // Validate goniType
    const goniType = await prisma.goniType.findFirst({
      where: { id: goniTypeId, isActive: true },
      select: { id: true, name: true },
    });
    if (!goniType) {
      throw new AppError("Goni type not found", 404);
    }

    const isTracked = await isTrackedGoniType(goniTypeId);
    if (isTracked) {
      const availableBagsByType = await getVendorCurrentBagsForType(
        vendorId,
        goniTypeId,
      );
      if (bagCount > availableBagsByType) {
        throw new AppError(
          `Transfer bag count (${bagCount}) exceeds available ${goniType.name} bags (${availableBagsByType})`,
          400,
        );
      }
    }

    if (bagCount > availableBags) {
      throw new AppError(
        `Transfer bag count (${bagCount}) exceeds available stock (${availableBags})`,
        400,
      );
    }

    const transferNo = await generateTransferNo();

    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNo,
        vendorId,
        goniTypeId,
        vendorEnteredWeight: weight,
        vendorEnteredUnit: unit,
        weight,
        unit,
        bagCount,
        shopName,
        shopLocation,
        vehicalNumber,
        status: "PENDING",
      },
      include: {
        vendor: {
          select: { id: true, name: true, phone: true },
        },
        goniType: true,
      },
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

    if (remainingWeight <= 0 || remainingBags <= 0) {
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

        const deductWeight = Math.min(stock.weight, remainingWeight);
        const deductBags = Math.min(stock.bagCount, remainingBags);

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

      if (transfer.goniTypeId && (await isTrackedGoniType(transfer.goniTypeId))) {
        await tx.bagMovement.create({
          data: {
            vendorId: transfer.vendorId,
            goniTypeId: transfer.goniTypeId,
            transferId: transfer.id,
            bagCount: transfer.bagCount,
            movementType: "VENDOR_TO_ADMIN",
            createdById: req.user?.id,
          },
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

    const now = new Date();
    const updateData: any = {};

    if (weight !== undefined) {
      updateData.weight = weight;
      updateData.adminAdjustedWeight = weight;
      updateData.vendorEnteredWeight =
        transfer.vendorEnteredWeight ?? transfer.weight ?? null;
      updateData.adminAdjustedAt = now;
    }

    if (unit !== undefined) {
      updateData.unit = unit;
      updateData.adminAdjustedUnit = unit;
      updateData.vendorEnteredUnit = transfer.vendorEnteredUnit ?? transfer.unit;
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
        adminAdjustedWeight: true,
        weight: true,
      },
    });

    const analysis = completedTransfersForAnalysis.reduce(
      (acc, transfer) => {
        const vendorWeight =
          transfer.vendorEnteredWeight ?? transfer.weight ?? 0;
        const adminWeight =
          transfer.adminAdjustedWeight ?? transfer.weight ?? 0;

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
