import { Request, Response, NextFunction } from "express";
import path from "node:path";
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
import {
  buildTransferProofUrl,
  enqueueTransferProofGeneration,
  writeTransferProofPdf,
} from "../services/transferProof.service";

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
      thappiIds,
      items,
      sourceLocationId,
      destinationLocationId,
      vehicalNumber,
    } = req.body as {
      weight?: number;
      unit?: "QTL" | "MT";
      bagCount?: number;
      goniTypeId?: string;
      thappiIds?: string[];
      items?: Array<{ goniTypeId: string; bagCount: number }>;
      sourceLocationId: string;
      destinationLocationId: string;
      vehicalNumber: string;
    };

    const selectedThappiIds =
      Array.isArray(thappiIds) && thappiIds.length
        ? Array.from(new Set(thappiIds))
        : [];

    let normalizedItems =
      Array.isArray(items) && items.length
        ? items
        : goniTypeId && typeof bagCount === "number"
          ? [{ goniTypeId, bagCount }]
          : [];

    let thappiRows: Array<{
      id: string;
      weightQtl: number;
      bagCount: number;
      bagBreakdown: Array<{ goniTypeId: string; bagCount: number }>;
    }> = [];

    if (selectedThappiIds.length) {
      const fetched = await prisma.thappi.findMany({
        where: {
          id: { in: selectedThappiIds },
          vendorId,
          isActive: true,
          status: "AVAILABLE",
        },
        include: {
          bagBreakdown: {
            select: { goniTypeId: true, bagCount: true },
          },
        },
      });
      if (fetched.length !== selectedThappiIds.length) {
        throw new AppError("One or more thappis are invalid or unavailable", 400);
      }
      thappiRows = fetched;
      normalizedItems = fetched.flatMap((t) => t.bagBreakdown);
    }

    if (!normalizedItems.length) {
      throw new AppError(
        "Provide either items[] for multi-type transfer or goniTypeId + bagCount for single type",
        400,
      );
    }

    const allBagCountByType = new Map<string, number>();
    for (const item of normalizedItems) {
      const current = allBagCountByType.get(item.goniTypeId) ?? 0;
      allBagCountByType.set(item.goniTypeId, current + item.bagCount);
    }

    const transferItems = Array.from(allBagCountByType.entries()).map(
      ([typeId, totalBags]) => ({
        goniTypeId: typeId,
        bagCount: totalBags,
      }),
    );
    const normalizedWeightQtl = selectedThappiIds.length
      ? thappiRows.reduce((sum, t) => sum + t.weightQtl, 0)
      : typeof weight === "number"
        ? toQtl(weight, unit ?? "QTL")
        : undefined;

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

    const totalBagCount = transferItems.reduce((sum, item) => {
      const currentType = goniTypeMap.get(item.goniTypeId)!;
      return currentType.isTracked ? sum + item.bagCount : sum;
    }, 0);
    if (totalBagCount > availableBags) {
      throw new AppError(
        `Transfer tracked bag count (${totalBagCount}) exceeds available stock (${availableBags})`,
        400,
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
        select: { id: true, name: true, type: true },
      }),
      prisma.inventoryLocation.findFirst({
        where: { id: destinationLocationId, isActive: true },
        select: { id: true, name: true, type: true },
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

    const allowedPairs = new Set([
      "VENDOR->VENDOR",
      "VENDOR->PLANT",
      "VENDOR->GODOWN",
      "GODOWN->PLANT",
      "GODOWN->VENDOR",
    ]);
    const routeKey = `${sourceLocation.type}->${destinationLocation.type}`;
    if (!allowedPairs.has(routeKey)) {
      throw new AppError(
        `Unsupported transfer route ${routeKey}. Allowed: Vendor->Vendor, Vendor->Plant, Vendor->Godown, Godown->Plant, Godown->Vendor`,
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
        data: normalizedItems.map((item) => ({
          transferId: createdTransfer.id,
          goniTypeId: item.goniTypeId,
          bagCount: item.bagCount,
        })),
      });

      if (thappiRows.length) {
        await tx.stockTransferThappi.createMany({
          data: thappiRows.map((t) => ({
            transferId: createdTransfer.id,
            thappiId: t.id,
            weightQtl: t.weightQtl,
            bagCount: t.bagCount,
          })),
        });
      }

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
          thappis: {
            include: {
              thappi: {
                include: {
                  location: true,
                },
              },
            },
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
          thappis: {
            include: {
              thappi: {
                include: { location: true },
              },
            },
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
          thappis: {
            include: {
              thappi: {
                include: { location: true },
              },
            },
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
    const {
      weight,
      unit,
      bagCount,
      dispatchLatitude,
      dispatchLongitude,
      dispatchLocationText,
    } = req.body as {
      weight?: number;
      unit?: "QTL" | "MT";
      bagCount?: number;
      dispatchLatitude: number;
      dispatchLongitude: number;
      dispatchLocationText: string;
    };

    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        status: "PENDING",
      },
      include: {
        items: true,
        thappis: {
          select: { thappiId: true },
        },
        vendor: {
          select: { name: true },
        },
        sourceLocation: {
          select: { name: true },
        },
        destinationLocation: {
          select: { name: true },
        },
      },
    });

    if (!transfer) {
      throw new AppError("Transfer not found or already processed", 404);
    }

    const dispatchWeightQtl =
      typeof weight === "number"
        ? toQtl(weight, unit ?? "QTL")
        : (transfer.weight ?? 0);
    const dispatchBagCount =
      typeof bagCount === "number" ? bagCount : (transfer.bagCount ?? 0);

    // Get vendor's available stocks ordered by createdAt (FIFO)
    const availableStocks = await prisma.stock.findMany({
      where: {
        vendorId: transfer.vendorId,
        status: "AVAILABLE",
      },
      orderBy: { createdAt: "asc" },
    });

    let remainingWeight = dispatchWeightQtl;
    let remainingBags = dispatchBagCount;

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
          weight: dispatchWeightQtl,
          unit: "QTL",
          bagCount: dispatchBagCount,
          dispatchedWeight: dispatchWeightQtl,
          dispatchedBagCount: dispatchBagCount,
          dispatchedAt: new Date(),
          dispatchLatitude,
          dispatchLongitude,
          dispatchLocationText,
          dispatchById: req.user?.id,
          dispatchProofUrl: buildTransferProofUrl(transfer.transferNo, "dispatch"),
          status: "DISPATCHED",
        },
      });

      if (transfer.thappis.length) {
        const thappiRows = await tx.thappi.findMany({
          where: { id: { in: transfer.thappis.map((t) => t.thappiId) } },
          select: { id: true, weightQtl: true, bagCount: true, locationId: true },
        });
        await tx.thappi.updateMany({
          where: {
            id: { in: transfer.thappis.map((t) => t.thappiId) },
            status: "AVAILABLE",
          },
          data: {
            status: "TRANSFERRED",
          },
        });
        if (thappiRows.length) {
          await tx.thappiMovement.createMany({
            data: thappiRows.map((t) => ({
              thappiId: t.id,
              transferId: transfer.id,
              movementType: "TRANSFER_OUT",
              weightQtl: t.weightQtl,
              bagCount: t.bagCount,
              fromLocationId: transfer.sourceLocationId,
              toLocationId: transfer.destinationLocationId,
              createdById: req.user?.id,
            })),
          });
        }
      }

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

    enqueueTransferProofGeneration({
      transferId: transfer.id,
      transferNo: transfer.transferNo,
      stage: "dispatch",
    });

    const dispatchProofUrl = buildTransferProofUrl(
      transfer.transferNo,
      "dispatch",
    );
    await writeTransferProofPdf({
      absolutePath: path.join(
        process.cwd(),
        dispatchProofUrl.replace(/^\/+/, "").replace(/\//g, path.sep),
      ),
      stage: "dispatch",
      transferNo: transfer.transferNo,
      vendorName: transfer.vendor?.name,
      source: transfer.sourceLocation?.name,
      destination: transfer.destinationLocation?.name,
      vehicle: transfer.vehicalNumber,
      weightQtl: dispatchWeightQtl,
      bagCount: dispatchBagCount,
      latitude: dispatchLatitude,
      longitude: dispatchLongitude,
      locationText: dispatchLocationText,
      status: "DISPATCHED",
    });

    successResponse(res, null, "Transfer dispatched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Receive transfer (Admin) - captures received quantity and computes shortages
 */
export const receiveTransfer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { transferId } = req.params;
    const {
      receivedWeight,
      receivedUnit,
      receivedBagCount,
      receiveLatitude,
      receiveLongitude,
      receiveLocationText,
    } = req.body as {
      receivedWeight: number;
      receivedUnit?: "QTL" | "MT";
      receivedBagCount: number;
      receiveLatitude: number;
      receiveLongitude: number;
      receiveLocationText: string;
    };

    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        status: "DISPATCHED",
      },
      include: {
        vendor: {
          select: { name: true },
        },
        sourceLocation: {
          select: { name: true },
        },
        destinationLocation: {
          select: { name: true },
        },
      },
    });

    if (!transfer) {
      throw new AppError("Transfer not found or not in dispatched state", 404);
    }

    const dispatchedWeight = transfer.dispatchedWeight ?? transfer.weight ?? 0;
    const dispatchedBags = transfer.dispatchedBagCount ?? transfer.bagCount ?? 0;
    const receivedWeightQtl = toQtl(receivedWeight, receivedUnit ?? "QTL");

    const weightShortage = Math.max(dispatchedWeight - receivedWeightQtl, 0);
    const bagShortage = Math.max(dispatchedBags - receivedBagCount, 0);
    const nextStatus = weightShortage > 0 || bagShortage > 0 ? "DISCREPANCY" : "RECEIVED";

    const updated = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        receivedWeight: receivedWeightQtl,
        receivedBagCount,
        receivedAt: new Date(),
        receiveLatitude,
        receiveLongitude,
        receiveLocationText,
        receiveById: req.user?.id,
        receiveProofUrl: buildTransferProofUrl(transfer.transferNo, "receive"),
        weightShortage,
        bagShortage,
        status: nextStatus,
        completedAt: new Date(),
      },
      include: {
        vendor: {
          select: { id: true, name: true, phone: true },
        },
        sourceLocation: true,
        destinationLocation: true,
        items: {
          include: { goniType: true },
        },
      },
    });

    enqueueTransferProofGeneration({
      transferId: transfer.id,
      transferNo: transfer.transferNo,
      stage: "receive",
    });

    const receiveProofUrl = buildTransferProofUrl(transfer.transferNo, "receive");
    await writeTransferProofPdf({
      absolutePath: path.join(
        process.cwd(),
        receiveProofUrl.replace(/^\/+/, "").replace(/\//g, path.sep),
      ),
      stage: "receive",
      transferNo: transfer.transferNo,
      vendorName: transfer.vendor?.name,
      source: transfer.sourceLocation?.name,
      destination: transfer.destinationLocation?.name,
      vehicle: transfer.vehicalNumber,
      weightQtl: receivedWeightQtl,
      bagCount: receivedBagCount,
      latitude: receiveLatitude,
      longitude: receiveLongitude,
      locationText: receiveLocationText,
      status: nextStatus,
    });

    const destLocationId = updated.destinationLocationId;
    if (destLocationId && receivedWeightQtl > 0) {
      const sourceLocationId = updated.sourceLocationId;
      const receiveThappiCode = `${updated.transferNo}-RCV`;
      await prisma.$transaction(async (tx) => {
        const bagMap = new Map<string, number>();
        const items = await tx.stockTransferItem.findMany({
          where: { transferId: updated.id },
          select: { goniTypeId: true, bagCount: true },
        });
        for (const item of items) {
          bagMap.set(item.goniTypeId, (bagMap.get(item.goniTypeId) ?? 0) + item.bagCount);
        }
        const created = await tx.thappi.create({
          data: {
            vendorId: updated.vendorId,
            locationId: destLocationId,
            code: `${receiveThappiCode}-${Date.now().toString().slice(-6)}`,
            weightQtl: receivedWeightQtl,
            bagCount: receivedBagCount,
            status: "AVAILABLE",
            isActive: true,
          },
        });
        if (bagMap.size) {
          await tx.thappiBagBreakdown.createMany({
            data: Array.from(bagMap.entries()).map(([goniTypeId, bagCount]) => ({
              thappiId: created.id,
              goniTypeId,
              bagCount,
            })),
          });
        }
        await tx.thappiMovement.create({
          data: {
            thappiId: created.id,
            transferId: updated.id,
            movementType: "TRANSFER_IN",
            weightQtl: receivedWeightQtl,
            bagCount: receivedBagCount,
            fromLocationId: sourceLocationId,
            toLocationId: destLocationId,
            createdById: req.user?.id,
          },
        });
      });
    }

    successResponse(res, updated, "Transfer received and verified");
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
        thappis: {
          include: {
            thappi: {
              include: { location: true },
            },
          },
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
    const receivedLikeStatuses = ["RECEIVED", "DISCREPANCY", "COMPLETED"] as const;

    // Total received transfers
    const receivedTransfers = await prisma.stockTransfer.findMany({
      where: { status: { in: receivedLikeStatuses as any } },
      select: {
        weight: true,
        bagCount: true,
        receivedWeight: true,
        receivedBagCount: true,
      },
    });
    const totalReceived = receivedTransfers.reduce(
      (acc, t) => {
        acc.weight += t.receivedWeight ?? t.weight ?? 0;
        acc.bagCount += t.receivedBagCount ?? t.bagCount ?? 0;
        acc.transfers += 1;
        return acc;
      },
      { weight: 0, bagCount: 0, transfers: 0 },
    );

    // Pending transfers
    const pendingTransfers = await prisma.stockTransfer.aggregate({
      where: { status: { in: ["PENDING", "DISPATCHED"] } },
      _sum: {
        weight: true,
        bagCount: true,
      },
      _count: true,
    });

    // By vendor
    const byVendor = await prisma.stockTransfer.groupBy({
      by: ["vendorId"],
      where: { status: { in: receivedLikeStatuses as any } },
      _sum: {
        receivedWeight: true,
        receivedBagCount: true,
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
      where: { status: { in: receivedLikeStatuses as any } },
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
          weight: totalReceived.weight || 0,
          bagCount: totalReceived.bagCount || 0,
          transfers: totalReceived.transfers,
        },
        pendingTransfers: {
          weight: pendingTransfers._sum.weight || 0,
          bagCount: pendingTransfers._sum.bagCount || 0,
          count: pendingTransfers._count,
        },
        analysis,
        byVendor: byVendorWithDetails.map((v) => ({
          ...v,
          _sum: {
            ...v._sum,
            weight: v._sum.receivedWeight ?? v._sum.weight ?? 0,
            bagCount: v._sum.receivedBagCount ?? v._sum.bagCount ?? 0,
          },
        })),
      },
      "Admin stock summary fetched",
    );
  } catch (error) {
    next(error);
  }
};
