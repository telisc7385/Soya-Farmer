import { InventoryLocationType } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";

const locationPrefixByType: Record<string, string> = {
  VENDOR: "VND",
  GODOWN: "GDN",
  PLANT: "PLT",
};

const generateLocationCode = async (type: InventoryLocationType) => {
  const prefix = locationPrefixByType[type] ?? "LOC";
  const count = await prisma.inventoryLocation.count({ where: { type } });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

export const createInventoryLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, type, isActive } = req.body;
    const createdById = req.user?.id;

    const generatedCode = await generateLocationCode(type);

    const location = await prisma.inventoryLocation.create({
      data: {
        name: name.trim(),
        code: generatedCode,
        type,
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
    const { type, isActive, page = 1, limit = 20 } = req.query as any;
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      prisma.inventoryLocation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
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
    const { name, code, type, isActive } = req.body;

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
        type,
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
