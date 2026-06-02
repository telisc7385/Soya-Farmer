import { NextFunction, Response } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { AuthRequest } from "../middleware/auth.middleware";

const generateThappiCode = async () => {
  const count = await prisma.thappi.count();
  return `THP-${String(count + 1).padStart(6, "0")}`;
};

export const createThappi = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const {
      locationId,
      weightQtl,
      moisture,
      fm,
      damage,
      imageUrl,
      bagBreakdown,
    } = req.body as {
      locationId: string;
      weightQtl: number;
      moisture?: number;
      fm?: number;
      damage?: number;
      imageUrl?: string;
      bagBreakdown: Array<{ goniTypeId: string; bagCount: number }>;
    };

    const location = await prisma.inventoryLocation.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true },
    });
    if (!location) throw new AppError("Invalid or inactive location", 400);

    const typeIds = [...new Set(bagBreakdown.map((b) => b.goniTypeId))];
    const types = await prisma.goniType.findMany({
      where: { id: { in: typeIds }, isActive: true },
      select: { id: true },
    });
    if (types.length !== typeIds.length) {
      throw new AppError("Invalid or inactive goni type in bag breakdown", 400);
    }

    const bagCount = bagBreakdown.reduce((sum, row) => sum + row.bagCount, 0);

    const finalCode = await generateThappiCode();

    const thappi = await prisma.$transaction(async (tx) => {
      const created = await tx.thappi.create({
        data: {
          vendorId,
          locationId,
          code: finalCode,
          weightQtl,
          bagCount,
          moisture,
          fm,
          damage,
          imageUrl: imageUrl?.trim(),
          status: "AVAILABLE",
        },
      });

      await tx.thappiBagBreakdown.createMany({
        data: bagBreakdown.map((row) => ({
          thappiId: created.id,
          goniTypeId: row.goniTypeId,
          bagCount: row.bagCount,
        })),
      });
      await tx.thappiMovement.create({
        data: {
          thappiId: created.id,
          movementType: "CREATE",
          weightQtl: created.weightQtl,
          bagCount: created.bagCount,
          toLocationId: created.locationId,
          createdById: vendorId,
        },
      });

      return tx.thappi.findUnique({
        where: { id: created.id },
        include: {
          location: true,
          bagBreakdown: { include: { goniType: true } },
        },
      });
    });

    createdResponse(res, thappi, "Thappi created");
  } catch (error: any) {
    if (error?.code === "P2002") {
      return next(new AppError("Thappi code already exists", 409));
    }
    next(error);
  }
};

export const getVendorThappis = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const { locationId, status, page = 1, limit = 20 } = req.query as any;
    const where: any = { vendorId, isActive: true };
    if (locationId) where.locationId = locationId;
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      prisma.thappi.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          location: true,
          bagBreakdown: { include: { goniType: true } },
        },
      }),
      prisma.thappi.count({ where }),
    ]);

    successResponse(
      res,
      {
        thappis: rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Vendor thappis fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const updateThappiQuality = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { thappiId } = req.params;
    const { moisture, fm, damage } = req.body as {
      moisture: number;
      fm: number;
      damage: number;
    };

    const existing = await prisma.thappi.findUnique({ where: { id: thappiId } });
    if (!existing) throw new AppError("Thappi not found", 404);

    const updated = await prisma.thappi.update({
      where: { id: thappiId },
      data: { moisture, fm, damage },
    });

    successResponse(res, updated, "Thappi quality updated");
  } catch (error) {
    next(error);
  }
};
