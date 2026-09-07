import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { toQtl } from "../utils/quantity";
import {
  getFarmerReturnDue,
  getVendorBagLedgerSummary,
  isTrackedGoniType,
} from "../services/bagLedger.service";
import { BagMovementType } from "@prisma/client";

export const getVendorBagSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const goniTypeId =
      typeof req.query.goniTypeId === "string"
        ? req.query.goniTypeId
        : undefined;

    if (goniTypeId) {
      const goniType = await prisma.goniType.findFirst({
        where: { id: goniTypeId, isActive: true, isTracked: true },
        select: { id: true },
      });
      if (!goniType) {
        throw new AppError("Only tracked bag type can be queried", 400);
      }
    }

    const summary = await getVendorBagLedgerSummary(vendorId, goniTypeId);
    successResponse(res, summary, "Vendor bag stock summary fetched");
  } catch (error) {
    next(error);
  }
};

export const returnBagsToFarmer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { farmerId, goniTypeId, bagCount, items, notes } = req.body as {
      farmerId: string;
      goniTypeId?: string;
      bagCount?: number;
      items?: Array<{ goniTypeId: string; bagCount: number }>;
      notes?: string;
    };

    // Normalize single-type request into bulk items
    const returnItems: Array<{ goniTypeId: string; bagCount: number }> =
      items && items.length
        ? items
        : [{ goniTypeId: goniTypeId as string, bagCount: bagCount as number }];

    const farmer = await prisma.farmer.findFirst({
      where: { id: farmerId },
      select: { id: true },
    });
    if (!farmer) {
      throw new AppError("Farmer not found", 404);
    }

    const typeCountMap = new Map<string, number>();
    for (const item of returnItems) {
      typeCountMap.set(item.goniTypeId, (typeCountMap.get(item.goniTypeId) ?? 0) + item.bagCount);
    }
    const requestedTypeIds = Array.from(typeCountMap.keys());

    const [goniTypes, trackedIds] = await Promise.all([
      prisma.goniType.findMany({
        where: { id: { in: requestedTypeIds }, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.goniType.findMany({
        where: { id: { in: requestedTypeIds }, isTracked: true, isActive: true },
        select: { id: true },
      }),
    ]);

    if (goniTypes.length !== requestedTypeIds.length) {
      throw new AppError("One or more goni types not found or inactive", 404);
    }

    const trackedIdSet = new Set(trackedIds.map((type) => type.id));
    const nonTracked = requestedTypeIds.filter((id) => !trackedIdSet.has(id));
    if (nonTracked.length) {
      throw new AppError(
        "Only tracked bag type is allowed for bag ledger flow",
        400,
      );
    }

    const movements = await prisma.$transaction(async (tx) => {
      for (const item of returnItems) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bags:farmer:${farmerId}:${item.goniTypeId}`}))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bags:${vendorId}:${item.goniTypeId}`}))`;
      }

      const [receivedRows, returnedRows, vendorInRows, vendorOutRows] =
        await Promise.all([
          tx.bagMovement.groupBy({
            by: ["goniTypeId"],
            where: {
              farmerId,
              goniTypeId: { in: requestedTypeIds },
              movementType: BagMovementType.FARMER_TO_VENDOR,
            },
            _sum: { bagCount: true },
          }),

          tx.bagMovement.groupBy({
            by: ["goniTypeId"],
            where: {
              farmerId,
              goniTypeId: { in: requestedTypeIds },
              movementType: BagMovementType.VENDOR_TO_FARMER,
            },
            _sum: { bagCount: true },
          }),

          tx.bagMovement.groupBy({
            by: ["goniTypeId"],
            where: {
              vendorId,
              goniTypeId: { in: requestedTypeIds },
              movementType: {
                in: [
                  BagMovementType.FARMER_TO_VENDOR,
                  BagMovementType.ADMIN_TO_VENDOR,
                  BagMovementType.ADMIN_TO_VENDOR_ADD,
                  BagMovementType.VENDOR_SELF_ADD,
                ],
              },
            },
            _sum: { bagCount: true },
          }),

          tx.bagMovement.groupBy({
            by: ["goniTypeId"],
            where: {
              vendorId,
              goniTypeId: { in: requestedTypeIds },
              movementType: {
                in: [
                  BagMovementType.VENDOR_TO_FARMER,
                  BagMovementType.VENDOR_TO_ADMIN,
                ],
              },
            },
            _sum: { bagCount: true },
          }),
        ]);

      const received = new Map(receivedRows.map((r) => [r.goniTypeId, r._sum.bagCount ?? 0]));
      const returned = new Map(returnedRows.map((r) => [r.goniTypeId, r._sum.bagCount ?? 0]));
      const vendorIn = new Map(vendorInRows.map((r) => [r.goniTypeId, r._sum.bagCount ?? 0]));
      const vendorOut = new Map(vendorOutRows.map((r) => [r.goniTypeId, r._sum.bagCount ?? 0]));

      const errors: string[] = [];
      for (const [typeId, bagCount] of typeCountMap.entries()) {
        const farmerDue = (received.get(typeId) ?? 0) - (returned.get(typeId) ?? 0);
        const vendorOnHand = (vendorIn.get(typeId) ?? 0) - (vendorOut.get(typeId) ?? 0);
        const typeName = goniTypes.find((type) => type.id === typeId)?.name ?? typeId;

        if (bagCount > farmerDue) {
          errors.push(
            `${typeName}: return count (${bagCount}) exceeds farmer's available (${Math.max(farmerDue, 0)})`,
          );
        }
        if (bagCount > vendorOnHand) {
          errors.push(
            `${typeName}: return count (${bagCount}) exceeds your available stock (${Math.max(vendorOnHand, 0)})`,
          );
        }
      }
      if (errors.length) {
        throw new AppError(`Cannot return bags: ${errors.join(". ")}`, 400);
      }

      const data = returnItems.map((item) => ({
        vendorId,
        farmerId,
        goniTypeId: item.goniTypeId,
        bagCount: item.bagCount,
        movementType: BagMovementType.VENDOR_TO_FARMER,
        notes,
        createdById: vendorId,
      }));

      return tx.bagMovement.createMany({ data });
    });

    createdResponse(res, movements, "Bags returned to farmer");
  } catch (error) {
    next(error);
  }
};

export const getVendorReturnDueToFarmer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;

    const farmer = await prisma.farmer.findFirst({
      where: { id: farmerId },
      select: { id: true },
    });
    if (!farmer) {
      throw new AppError("Farmer not found", 404);
    }

    const goniTypeId =
      typeof req.query.goniTypeId === "string"
        ? req.query.goniTypeId
        : undefined;

    const summary = await getFarmerReturnDue(farmerId, goniTypeId);

    successResponse(res, summary, "Farmer bag return due fetched");
  } catch (error) {
    next(error);
  }
};

export const adminReturnBagsToVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError("Unauthorized", 401);

    const { vendorId } = req.params;
    const { goniTypeId, bagCount, notes } = req.body as {
      goniTypeId: string;
      bagCount: number;
      notes?: string;
    };

    const [vendor, goniType, isTracked] = await Promise.all([
      prisma.user.findFirst({
        where: { id: vendorId, role: "VENDOR", isActive: true },
        select: { id: true, name: true },
      }),
      prisma.goniType.findFirst({
        where: { id: goniTypeId, isActive: true },
        select: { id: true, name: true },
      }),
      isTrackedGoniType(goniTypeId),
    ]);

    if (!vendor) {
      throw new AppError("Vendor not found or inactive", 404);
    }
    if (!goniType) {
      throw new AppError("Goni type not found or inactive", 404);
    }
    if (!isTracked) {
      throw new AppError(
        "Only tracked bag type is allowed for bag ledger flow",
        400,
      );
    }

    const movement = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bags:${vendorId}:${goniTypeId}`}))`;

      const [availableBagsForSelectedVendor, returnedBagsForSelectedVendor] =
        await Promise.all([
          tx.bagMovement.aggregate({
            where: {
              vendorId,
              goniTypeId,
              movementType: BagMovementType.VENDOR_TO_ADMIN,
            },
            _sum: { bagCount: true },
          }),

          tx.bagMovement.aggregate({
            where: {
              vendorId,
              goniTypeId,
              movementType: BagMovementType.ADMIN_TO_VENDOR,
            },
            _sum: { bagCount: true },
          }),
        ]);

      const availableBags = availableBagsForSelectedVendor._sum.bagCount || 0;
      const returnedBags = returnedBagsForSelectedVendor._sum.bagCount || 0;

      if (bagCount > availableBags - returnedBags) {
        throw new AppError(
          `Return bag count (${bagCount}) exceeds available ${goniType.name} bags (${availableBags - returnedBags})`,
          400,
        );
      }

      return tx.bagMovement.create({
        data: {
          vendorId,
          goniTypeId,
          bagCount,
          movementType: "ADMIN_TO_VENDOR",
          notes: notes?.trim()
            ? notes
            : `Returned against to vendor ${vendor.name} by admin`,
          createdById: adminId,
        },
        include: {
          vendor: { select: { id: true, name: true, phone: true } },
          goniType: { select: { id: true, name: true } },
        },
      });
    });

    createdResponse(res, movement, "Bags returned to vendor");
  } catch (error) {
    next(error);
  }
};

export const adminOpeningBagsToVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError("Unauthorized", 401);

    const { vendorId } = req.params;
    const { goniTypeId, bagCount, notes, weight, unit } = req.body as {
      goniTypeId: string;
      bagCount: number;
      notes?: string;
      weight?: number;
      unit?: "QTL" | "MT";
    };

    const [vendor, goniType, isTracked] = await Promise.all([
      prisma.user.findFirst({
        where: { id: vendorId, role: "VENDOR", isActive: true },
        select: { id: true, name: true },
      }),
      prisma.goniType.findFirst({
        where: { id: goniTypeId, isActive: true },
        select: { id: true, name: true },
      }),
      isTrackedGoniType(goniTypeId),
    ]);

    if (!vendor) {
      throw new AppError("Vendor not found or inactive", 404);
    }
    if (!goniType) {
      throw new AppError("Goni type not found or inactive", 404);
    }
    if (!isTracked) {
      throw new AppError(
        "Only tracked bag type is allowed for bag ledger flow",
        400,
      );
    }

    const stockWeightQtl =
      typeof weight === "number" && Number.isFinite(weight) && weight > 0
        ? toQtl(weight, unit ?? "QTL")
        : null;

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.bagMovement.create({
        data: {
          vendorId,
          goniTypeId,
          bagCount,
          movementType: "ADMIN_TO_VENDOR_ADD",
          notes: notes?.trim()
            ? notes
            : `Opening stock issued to vendor ${vendor.name}`,
          createdById: adminId,
        },
        include: {
          vendor: { select: { id: true, name: true, phone: true } },
          goniType: { select: { id: true, name: true } },
        },
      });

      let openingStock = null;
      if (stockWeightQtl !== null) {
        openingStock = await tx.stock.create({
          data: {
            vendorId,
            billId: null,
            weight: stockWeightQtl,
            unit: "QTL",
            bagCount,
            goniTypeId,
            status: "AVAILABLE",
          },
        });
      }

      return { movement, openingStock };
    });

    createdResponse(
      res,
      result,
      "Opening stock added to vendor",
    );
  } catch (error) {
    next(error);
  }
};

export const vendorAddOwnBags = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { goniTypeId, bagCount, notes } = req.body as {
      goniTypeId: string;
      bagCount: number;
      notes?: string;
    };

    const [goniType, isTracked] = await Promise.all([
      prisma.goniType.findFirst({
        where: { id: goniTypeId, isActive: true },
        select: { id: true, name: true },
      }),
      isTrackedGoniType(goniTypeId),
    ]);

    if (!goniType) {
      throw new AppError("Goni type not found or inactive", 404);
    }
    if (!isTracked) {
      throw new AppError(
        "Only tracked bag type is allowed for bag ledger flow",
        400,
      );
    }

    const movement = await prisma.bagMovement.create({
      data: {
        vendorId,
        goniTypeId,
        bagCount,
        movementType: "VENDOR_SELF_ADD",
        notes: notes?.trim() ? notes : "Vendor self-added opening stock",
        createdById: vendorId,
      },
      include: {
        vendor: { select: { id: true, name: true, phone: true } },
        goniType: { select: { id: true, name: true } },
      },
    });

    createdResponse(res, movement, "Vendor opening stock added");
  } catch (error) {
    next(error);
  }
};
