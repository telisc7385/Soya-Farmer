import { NextFunction, Response } from "express";
import prisma from "../../database/prisma";
import { createdResponse, successResponse } from "../../utils/response";
import { AppError } from "../../core/appError";
import { AuthRequest } from "../../middleware/auth.middleware";

export const createGoniType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401);
    const userId = req.user.id;
    const {
      name,
      weightPerBag,
      isTracked = true,
      isVariant = true,
      parentId,
      variants,
    } = req.body;

    // Single bag type (no variants) — or a variant under an existing family
    if (isVariant) {
      if (Array.isArray(variants) && variants.length) {
        throw new AppError(
          "A single bag type cannot also define variants; create a bag family (isVariant: false) instead",
          400,
        );
      }
      if (typeof weightPerBag !== "number") {
        throw new AppError(
          "weightPerBag is required for bag variants (e.g. 0.4 for 400 gm)",
          400,
        );
      }
      if (parentId) {
        const parent = await prisma.goniType.findFirst({
          where: { id: parentId, isVariant: false, isActive: true },
          select: { id: true },
        });
        if (!parent) {
          throw new AppError(
            "parentId must reference an existing active bag family",
            400,
          );
        }
      }

      const goniType = await prisma.goniType.create({
        data: {
          name,
          weightPerBag,
          isActive: true,
          isTracked,
          isVariant: true,
          parentId: parentId ?? null,
          createdBy: userId,
        },
      });

      return createdResponse(res, goniType, "Goni type created");
    }

    // Bag family — optionally created together with its weight variants
    if (weightPerBag != null) {
      throw new AppError(
        "Bag families must not have a weight; add weight variants under them",
        400,
      );
    }
    if (parentId) {
      throw new AppError("Bag families cannot have a parent", 400);
    }

    const variantSeeds = Array.isArray(variants) ? variants : [];
    const variantNames = new Set<string>();
    for (const variant of variantSeeds) {
      if (variantNames.has(variant.name)) {
        throw new AppError(`Duplicate variant name: ${variant.name}`, 400);
      }
      variantNames.add(variant.name);
    }

    const family = await prisma.$transaction(async (tx) => {
      const created = await tx.goniType.create({
        data: {
          name,
          weightPerBag: null,
          isActive: true,
          isTracked: false,
          isVariant: false,
          createdBy: userId,
        },
      });

      if (variantSeeds.length) {
        await tx.goniType.createMany({
          data: variantSeeds.map((variant) => ({
            name: variant.name,
            weightPerBag: variant.weightPerBag,
            isActive: true,
            isTracked: variant.isTracked ?? true,
            isVariant: true,
            parentId: created.id,
            createdBy: userId,
          })),
        });
      }

      return tx.goniType.findUnique({
        where: { id: created.id },
        include: { children: true },
      });
    });

    createdResponse(
      res,
      family,
      variantSeeds.length
        ? "Bag family with variants created"
        : "Bag family created (add variants later if needed)",
    );
  } catch (error) {
    next(error);
  }
};

export const updateGoniType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { goniTypeId } = req.params;
    const { name, weightPerBag, isActive, isTracked, isVariant, parentId } =
      req.body;

    const existing = await prisma.goniType.findUnique({
      where: { id: goniTypeId },
      include: {
        children: { select: { id: true } },
        _count: {
          select: {
            billGonis: true,
            bagMoves: true,
            stocks: true,
            transfers: true,
            transferItems: true,
            thappiBagBreakdowns: true,
          },
        },
      },
    });
    if (!existing) throw new AppError("Goni type not found", 404);

    const targetVariant =
      typeof isVariant === "boolean" ? isVariant : existing.isVariant;
    const isConversion = targetVariant !== existing.isVariant;

    if (targetVariant) {
      if (weightPerBag == null && existing.weightPerBag == null) {
        throw new AppError(
          "weightPerBag is required for bag variants (e.g. 0.4 for 400 gm)",
          400,
        );
      }
      if (parentId !== undefined) {
        if (parentId === existing.id) {
          throw new AppError("parentId cannot reference the type itself", 400);
        }
        if (parentId) {
          const parent = await prisma.goniType.findFirst({
            where: { id: parentId, isVariant: false, isActive: true },
            select: { id: true },
          });
          if (!parent) {
            throw new AppError(
              "parentId must reference an existing active bag family",
              400,
            );
          }
        }
      }
      if (
        isConversion &&
        existing.isVariant === false &&
        existing.children.length > 0
      ) {
        throw new AppError(
          "Cannot convert a bag family that still has variants",
          400,
        );
      }
    } else {
      if (parentId) {
        throw new AppError("Bag families cannot have a parent", 400);
      }
      if (weightPerBag != null) {
        throw new AppError("Bag families must not have a weight", 400);
      }
      if (isConversion && existing.isVariant === true) {
        const historyCount =
          existing._count.billGonis +
          existing._count.bagMoves +
          existing._count.stocks +
          existing._count.transfers +
          existing._count.transferItems +
          existing._count.thappiBagBreakdowns;
        if (historyCount > 0) {
          throw new AppError(
            "Cannot convert a bag variant that already has history records",
            400,
          );
        }
      }
    }

    const updated = await prisma.goniType.update({
      where: { id: goniTypeId },
      data: {
        name,
        weightPerBag: targetVariant
          ? (weightPerBag ?? existing.weightPerBag)
          : null,
        isActive,
        isTracked: targetVariant
          ? typeof isTracked === "boolean"
            ? isTracked
            : existing.isTracked
          : false,
        isVariant: targetVariant,
        ...(parentId === undefined
          ? {}
          : { parentId: parentId ?? null }),
      },
    });

    successResponse(res, updated, "Goni type updated");
  } catch (error) {
    next(error);
  }
};

export const listGoniTypes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { kind } = req.query;

    const where =
      kind === "selectable"
        ? { isActive: true, isVariant: true }
        : {};

    const goniTypes = await prisma.goniType.findMany({
      where,
      include: {
        children: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const withWeightLabel = (types: typeof goniTypes) =>
      types.map((type) => ({
        ...type,
        weightLabel:
          type.weightPerBag != null
            ? `${Math.round(type.weightPerBag * 1000)} gm`
            : null,
      }));

    if (kind === "selectable") {
      return successResponse(
        res,
        withWeightLabel(goniTypes),
        "Usable bag variants fetched",
      );
    }

    const variants = goniTypes.filter((type) => type.isVariant);
    const families = goniTypes.filter((type) => !type.isVariant);

    const nested = [
      ...families.map((family) => ({
        ...family,
        children: variants.filter(
          (variant) => variant.parentId === family.id,
        ),
      })),
      ...variants.filter((variant) => !variant.parentId),
    ];

    successResponse(
      res,
      withWeightLabel(nested),
      "Goni types fetched",
    );
  } catch (error) {
    next(error);
  }
};