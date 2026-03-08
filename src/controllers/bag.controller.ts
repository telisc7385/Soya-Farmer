import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import {
  getVendorBagLedgerSummary,
  getVendorCurrentBagsForType,
  isTrackedGoniType,
} from "../services/bagLedger.service";

export const getVendorBagSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) throw new AppError("Unauthorized", 401);

    const goniTypeId =
      typeof req.query.goniTypeId === "string" ? req.query.goniTypeId : undefined;

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
      throw new AppError("Only tracked bag type is allowed for bag ledger flow", 400);
    }

    const availableBags = await getVendorCurrentBagsForType(vendorId, goniTypeId);
    if (bagCount > availableBags) {
      throw new AppError(
        `Return bag count (${bagCount}) exceeds available ${goniType.name} bags (${availableBags})`,
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

export const adminReturnBagsToVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError("Unauthorized", 401);

    const { vendorId } = req.params;
    const { billId, goniTypeId, bagCount, notes } = req.body as {
      billId: string;
      goniTypeId: string;
      bagCount: number;
      notes?: string;
    };

    const [vendor, goniType, bill, isTracked] = await Promise.all([
      prisma.user.findFirst({
        where: { id: vendorId, role: "VENDOR", isActive: true },
        select: { id: true, name: true },
      }),
      prisma.goniType.findFirst({
        where: { id: goniTypeId, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.bill.findFirst({
        where: { id: billId, vendorId },
        select: { id: true, billNo: true, status: true },
      }),
      isTrackedGoniType(goniTypeId),
    ]);

    if (!vendor) {
      throw new AppError("Vendor not found or inactive", 404);
    }
    if (!goniType) {
      throw new AppError("Goni type not found or inactive", 404);
    }
    if (!bill) {
      throw new AppError("Bill not found for this vendor", 404);
    }
    if (!["PENDING", "COMPLETED"].includes(bill.status)) {
      throw new AppError(
        "Bags can be returned only after payment request or payment completion",
        400,
      );
    }
    if (!isTracked) {
      throw new AppError("Only tracked bag type is allowed for bag ledger flow", 400);
    }

    const movement = await prisma.bagMovement.create({
      data: {
        vendorId,
        goniTypeId,
        bagCount,
        movementType: "ADMIN_TO_VENDOR",
        notes: notes?.trim() ? notes : `Returned against bill ${bill.billNo}`,
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

