import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";

const generateLocationCode = async () => {
  const count = await prisma.inventoryLocation.count();
  return `GDN-${String(count + 1).padStart(4, "0")}`;
};

export const createInventoryLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, isActive } = req.body;
    const createdById = req.user?.id;

    const generatedCode = await generateLocationCode();

    const location = await prisma.inventoryLocation.create({
      data: {
        name: name.trim(),
        code: generatedCode,
        isActive: typeof isActive === "boolean" ? isActive : true,
        createdById,
      },
    });

    createdResponse(res, location, "Inventory location created");
  } catch (error: any) {
    if (error?.code === "P2002") {
      return next(new AppError("Location code already exists", 409));
    }
    next(error);
  }
};

export const listInventoryLocations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query as any;
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      prisma.inventoryLocation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { vendorLocations: true },
          },
        },
      }),
      prisma.inventoryLocation.count({ where }),
    ]);

    successResponse(
      res,
      {
        locations: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Inventory locations fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const updateInventoryLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { locationId } = req.params;
    const { name, code, isActive } = req.body;

    const existing = await prisma.inventoryLocation.findUnique({
      where: { id: locationId },
    });
    if (!existing) {
      throw new AppError("Inventory location not found", 404);
    }

    const updated = await prisma.inventoryLocation.update({
      where: { id: locationId },
      data: {
        name: typeof name === "string" ? name.trim() : undefined,
        code:
          code === null || code === ""
            ? null
            : typeof code === "string"
              ? code.trim()
              : undefined,
        isActive,
      },
    });

    successResponse(res, updated, "Inventory location updated");
  } catch (error: any) {
    if (error?.code === "P2002") {
      return next(new AppError("Location code already exists", 409));
    }
    next(error);
  }
};

// =====================
// VENDOR LOCATION ASSIGNMENTS
// =====================

const parseAsLocations = (rows: Array<{ location: any }>) =>
  rows.map((row) => row.location);

/**
 * Vendor app: locations assigned to the logged-in vendor (active only) - used as transfer source.
 */
export const getVendorAssignedLocations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;

    const rows = await prisma.vendorLocation.findMany({
      where: {
        vendorId,
        location: { isActive: true },
      },
      select: {
        location: true,
      },
      orderBy: { createdAt: "desc" },
    });

    successResponse(
      res,
      parseAsLocations(rows),
      "Assigned locations fetched",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: list all locations assigned to a vendor.
 */
export const getVendorLocations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { vendorId } = req.params;

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId, role: "VENDOR" },
      select: { id: true },
    });
    if (!vendor) throw new AppError("Vendor not found", 404);

    const rows = await prisma.vendorLocation.findMany({
      where: { vendorId },
      select: { location: true },
      orderBy: { createdAt: "desc" },
    });

    successResponse(res, parseAsLocations(rows), "Vendor locations fetched");
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: replace a vendor's assigned locations (multi-locations per vendor).
 */
export const setVendorLocations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { vendorId } = req.params;
    const { locationIds } = req.body as { locationIds: string[] };

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId, role: "VENDOR" },
      select: { id: true },
    });
    if (!vendor) throw new AppError("Vendor not found", 404);

    const uniqueIds = Array.from(new Set(locationIds));
    const locations = await prisma.inventoryLocation.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });
    if (locations.length !== uniqueIds.length) {
      throw new AppError(
        "One or more locations are invalid or inactive",
        400,
      );
    }

    await prisma.$transaction([
      prisma.vendorLocation.deleteMany({ where: { vendorId } }),
      ...(uniqueIds.length
        ? [
            prisma.vendorLocation.createMany({
              data: uniqueIds.map((locationId) => ({ vendorId, locationId })),
            }),
          ]
        : []),
    ]);

    const rows = await prisma.vendorLocation.findMany({
      where: { vendorId },
      select: { location: true },
      orderBy: { createdAt: "desc" },
    });

    successResponse(
      res,
      parseAsLocations(rows),
      "Vendor locations updated",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: list all vendors assigned to a location.
 */
export const getLocationVendors = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { locationId } = req.params;

    const location = await prisma.inventoryLocation.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) throw new AppError("Location not found", 404);

    const rows = await prisma.vendorLocation.findMany({
      where: { locationId },
      select: {
        vendor: {
          select: { id: true, name: true, phone: true, isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    successResponse(
      res,
      rows.map((row) => row.vendor),
      "Location vendors fetched",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: replace the vendors assigned to a location (multi-vendors per location).
 */
export const setLocationVendors = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { locationId } = req.params;
    const { vendorIds } = req.body as { vendorIds: string[] };

    const location = await prisma.inventoryLocation.findUnique({
      where: { id: locationId, isActive: true },
      select: { id: true },
    });
    if (!location) throw new AppError("Location not found or inactive", 400);

    const uniqueIds = Array.from(new Set(vendorIds));
    const vendors = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, role: "VENDOR", isActive: true },
      select: { id: true },
    });
    if (vendors.length !== uniqueIds.length) {
      throw new AppError(
        "One or more vendors are invalid or inactive",
        400,
      );
    }

    await prisma.$transaction([
      prisma.vendorLocation.deleteMany({ where: { locationId } }),
      ...(uniqueIds.length
        ? [
            prisma.vendorLocation.createMany({
              data: uniqueIds.map((vendorId) => ({ vendorId, locationId })),
            }),
          ]
        : []),
    ]);

    const rows = await prisma.vendorLocation.findMany({
      where: { locationId },
      select: {
        vendor: {
          select: { id: true, name: true, phone: true, isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    successResponse(
      res,
      rows.map((row) => row.vendor),
      "Location vendors updated",
    );
  } catch (error) {
    next(error);
  }
};