import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import {
  getVendorBagLedgerSummary,
  getVendorReturnDueForFarmer,
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
    debugger;
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { farmerId, goniTypeId, bagCount, notes } = req.body as {
      farmerId: string;
      goniTypeId: string;
      bagCount: number;
      notes?: string;
    };

    const [mapping, goniType, isTracked] = await Promise.all([
      prisma.vendorFarmer.findFirst({
        where: { vendorId, farmerId, isActive: true },
        select: { id: true },
      }),
      prisma.goniType.findFirst({
        where: { id: goniTypeId, isActive: true },
        select: { id: true, name: true },
      }),
      isTrackedGoniType(goniTypeId),
    ]);

    if (!mapping) {
      throw new AppError("Farmer is not linked to this vendor", 400);
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

    const [availableBagsForSelectedFarmer, returnedBagsForSelectedFarmer] =
      await Promise.all([
        prisma.bagMovement.aggregate({
          where: {
            vendorId,
            goniTypeId,
            movementType: BagMovementType.FARMER_TO_VENDOR,
            farmerId,
          },
          _sum: { bagCount: true },
        }),

        prisma.bagMovement.aggregate({
          where: {
            vendorId,
            goniTypeId,
            movementType: BagMovementType.VENDOR_TO_FARMER,
            farmerId,
          },
          _sum: { bagCount: true },
        }),
      ]);

    const availableBags = availableBagsForSelectedFarmer._sum.bagCount || 0;
    const returnedBags = returnedBagsForSelectedFarmer._sum.bagCount || 0;

    if (bagCount > availableBags - returnedBags) {
      throw new AppError(
        `Return bag count (${bagCount}) exceeds available ${goniType.name} bags (${availableBags - returnedBags})`,
        400,
      );
    }

    const movement = await prisma.bagMovement.create({
      data: {
        vendorId,
        farmerId,
        goniTypeId,
        bagCount,
        movementType: "VENDOR_TO_FARMER",
        notes,
        createdById: vendorId,
      },
      include: {
        farmer: { select: { id: true, name: true, phone: true } },
        goniType: { select: { id: true, name: true } },
      },
    });

    createdResponse(res, movement, "Bags returned to farmer");
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
    debugger;
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const { farmerId } = req.params;

    const mapping = await prisma.vendorFarmer.findFirst({
      where: { vendorId, farmerId, isActive: true },
      select: { id: true },
    });
    if (!mapping) {
      throw new AppError("Farmer is not linked to this vendor", 400);
    }

    const summary = await getVendorReturnDueForFarmer(vendorId, farmerId);

    successResponse(res, summary, "Vendor return due fetched");
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

    const [availableBagsForSelectedVendor, returnedBagsForSelectedVendor] =
      await Promise.all([
        prisma.bagMovement.aggregate({
          where: {
            vendorId,
            goniTypeId,
            movementType: BagMovementType.VENDOR_TO_ADMIN,
          },
          _sum: { bagCount: true },
        }),

        prisma.bagMovement.aggregate({
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

    const movement = await prisma.bagMovement.create({
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

    const movement = await prisma.bagMovement.create({
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

    createdResponse(res, movement, "Opening stock added to vendor");
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
