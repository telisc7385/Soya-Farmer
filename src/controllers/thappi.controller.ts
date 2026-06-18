import { NextFunction, Response } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { AuthRequest } from "../middleware/auth.middleware";
import { saveUploadedFile } from "../utils/upload";

export const createThappi = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const { locationId, weightQtl, moisture, fm, damage, bagBreakdown } =
      req.body as {
        locationId: string;
        weightQtl: number;
        moisture?: number;
        fm?: number;
        damage?: number;
        bagBreakdown: Array<{ goniTypeId: string; bagCount: number }>;
      };

    let imageUrl: string | undefined;
    if (req.file) {
      const { publicUrl } = await saveUploadedFile(req.file, "thappis/images");
      imageUrl = publicUrl;
    }

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

    let thappi;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (!thappi && attempts < MAX_ATTEMPTS) {
      try {
        thappi = await prisma.$transaction(async (tx) => {
          const last = await tx.thappi.findFirst({
            orderBy: { createdAt: "desc" },
            select: { code: true },
          });
          const lastNum = last
            ? parseInt(last.code.replace("THP-", ""), 10)
            : 0;
          const code = `THP-${String(lastNum + 1).padStart(6, "0")}`;

          const created = await tx.thappi.create({
            data: {
              vendorId,
              locationId,
              code,
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
      } catch (error: any) {
        if (error?.code === "P2002") {
          attempts++;
          continue;
        }
        throw error;
      }
    }

    if (!thappi) {
      throw new AppError("Failed to generate unique Thappi code", 409);
    }

    createdResponse(res, thappi, "Thappi created");
  } catch (error: any) {
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

export const deleteVendorThappi = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req.user?.id as string;
    const { thappiId } = req.params;

    const thappi = await prisma.thappi.findFirst({
      where: { id: thappiId, vendorId, isActive: true },
      select: { id: true, status: true },
    });

    if (!thappi) {
      throw new AppError("Thappi not found", 404);
    }

    if (thappi.status !== "AVAILABLE") {
      throw new AppError("Only available thappis can be deleted", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.thappiMovement.deleteMany({
        where: { thappiId: thappi.id },
      });
      await tx.thappiBagBreakdown.deleteMany({
        where: { thappiId: thappi.id },
      });
      await tx.thappi.delete({
        where: { id: thappi.id },
      });
    });

    successResponse(res, null, "Thappi deleted");
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

    const existing = await prisma.thappi.findUnique({
      where: { id: thappiId },
    });
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
