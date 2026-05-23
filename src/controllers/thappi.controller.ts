import { NextFunction, Response } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { AuthRequest } from "../middleware/auth.middleware";

export const createThappi = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const {
      locationId,
      code,
      weightQtl,
      moisture,
      fm,
      damage,
      imageUrl,
      bagBreakdown,
    } = req.body as {
      locationId: string;
      code: string;
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

    const thappi = await prisma.$transaction(async (tx) => {
      const created = await tx.thappi.create({
        data: {
          vendorId,
          locationId,
          code: code.trim(),
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

export const splitThappi = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const { thappiId } = req.params;
    const { parts } = req.body as {
      parts: Array<{
        code: string;
        weightQtl: number;
        moisture?: number;
        fm?: number;
        damage?: number;
        imageUrl?: string;
        bagBreakdown: Array<{ goniTypeId: string; bagCount: number }>;
      }>;
    };

    const base = await prisma.thappi.findFirst({
      where: { id: thappiId, vendorId, status: "AVAILABLE", isActive: true },
      include: { bagBreakdown: true },
    });
    if (!base) throw new AppError("Thappi not found or not splittable", 404);

    const totalPartWeight = parts.reduce((sum, p) => sum + p.weightQtl, 0);
    const totalPartBags = parts.reduce(
      (sum, p) => sum + p.bagBreakdown.reduce((x, y) => x + y.bagCount, 0),
      0,
    );
    if (Math.abs(totalPartWeight - base.weightQtl) > 0.001) {
      throw new AppError("Split weight must exactly match original thappi", 400);
    }
    if (totalPartBags !== base.bagCount) {
      throw new AppError("Split bag count must exactly match original thappi", 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.thappi.update({
        where: { id: base.id },
        data: { status: "TRANSFERRED", isActive: false },
      });

      await tx.thappiMovement.create({
        data: {
          thappiId: base.id,
          movementType: "SPLIT_OUT",
          weightQtl: base.weightQtl,
          bagCount: base.bagCount,
          fromLocationId: base.locationId,
          toLocationId: base.locationId,
          createdById: vendorId,
        },
      });

      const out: any[] = [];
      for (const part of parts) {
        const bagCount = part.bagBreakdown.reduce((s, r) => s + r.bagCount, 0);
        const t = await tx.thappi.create({
          data: {
            vendorId,
            locationId: base.locationId,
            code: part.code.trim(),
            weightQtl: part.weightQtl,
            bagCount,
            moisture: part.moisture,
            fm: part.fm,
            damage: part.damage,
            imageUrl: part.imageUrl?.trim(),
            status: "AVAILABLE",
            isActive: true,
          },
        });
        await tx.thappiBagBreakdown.createMany({
          data: part.bagBreakdown.map((r) => ({
            thappiId: t.id,
            goniTypeId: r.goniTypeId,
            bagCount: r.bagCount,
          })),
        });
        await tx.thappiMovement.create({
          data: {
            thappiId: t.id,
            movementType: "SPLIT_IN",
            weightQtl: t.weightQtl,
            bagCount: t.bagCount,
            fromLocationId: base.locationId,
            toLocationId: base.locationId,
            createdById: vendorId,
          },
        });
        out.push(t.id);
      }

      return tx.thappi.findMany({
        where: { id: { in: out } },
        include: {
          location: true,
          bagBreakdown: { include: { goniType: true } },
        },
      });
    });

    createdResponse(res, created, "Thappi split completed");
  } catch (error: any) {
    if (error?.code === "P2002") {
      return next(new AppError("One of split thappi codes already exists", 409));
    }
    next(error);
  }
};

export const mergeThappis = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const { thappiIds, code, locationId, moisture, fm, damage, imageUrl } = req
      .body as {
      thappiIds: string[];
      code: string;
      locationId: string;
      moisture?: number;
      fm?: number;
      damage?: number;
      imageUrl?: string;
    };

    const uniqueIds = Array.from(new Set(thappiIds));
    const rows = await prisma.thappi.findMany({
      where: {
        id: { in: uniqueIds },
        vendorId,
        status: "AVAILABLE",
        isActive: true,
      },
      include: { bagBreakdown: true },
    });
    if (rows.length !== uniqueIds.length) {
      throw new AppError("One or more thappis are invalid for merge", 400);
    }
    const sameLocation = rows.every((r) => r.locationId === rows[0].locationId);
    if (!sameLocation) {
      throw new AppError("All thappis must be from same location for merge", 400);
    }
    if (rows[0].locationId !== locationId) {
      throw new AppError(
        "Merged thappi location must match source thappis location",
        400,
      );
    }

    const sumWeight = rows.reduce((s, r) => s + r.weightQtl, 0);
    const sumBags = rows.reduce((s, r) => s + r.bagCount, 0);
    const bagMap = new Map<string, number>();
    for (const r of rows) {
      for (const b of r.bagBreakdown) {
        bagMap.set(b.goniTypeId, (bagMap.get(b.goniTypeId) ?? 0) + b.bagCount);
      }
    }

    const merged = await prisma.$transaction(async (tx) => {
      await tx.thappi.updateMany({
        where: { id: { in: uniqueIds } },
        data: { status: "TRANSFERRED", isActive: false },
      });

      for (const r of rows) {
        await tx.thappiMovement.create({
          data: {
            thappiId: r.id,
            movementType: "MERGE_OUT",
            weightQtl: r.weightQtl,
            bagCount: r.bagCount,
            fromLocationId: r.locationId,
            toLocationId: r.locationId,
            createdById: vendorId,
          },
        });
      }

      const created = await tx.thappi.create({
        data: {
          vendorId,
          locationId,
          code: code.trim(),
          weightQtl: sumWeight,
          bagCount: sumBags,
          moisture,
          fm,
          damage,
          imageUrl: imageUrl?.trim(),
          status: "AVAILABLE",
          isActive: true,
        },
      });

      await tx.thappiBagBreakdown.createMany({
        data: Array.from(bagMap.entries()).map(([goniTypeId, bagCount]) => ({
          thappiId: created.id,
          goniTypeId,
          bagCount,
        })),
      });

      await tx.thappiMovement.create({
        data: {
          thappiId: created.id,
          movementType: "MERGE_IN",
          weightQtl: sumWeight,
          bagCount: sumBags,
          fromLocationId: locationId,
          toLocationId: locationId,
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

    createdResponse(res, merged, "Thappis merged");
  } catch (error: any) {
    if (error?.code === "P2002") {
      return next(new AppError("Merged thappi code already exists", 409));
    }
    next(error);
  }
};
