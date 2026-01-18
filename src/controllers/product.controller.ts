import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";

/**
 * Create Product (ADMIN)
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, type } = req.body;

    const existing = await prisma.product.findFirst({
      where: { name, type },
    });

    if (existing) {
      throw new AppError("Product already exists", 409);
    }

    const product = await prisma.product.create({
      data: { name, type },
    });

    createdResponse(res, product, "Product created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get all products
 */
export const getProducts = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    successResponse(res, products, "Products fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const getProductsAdmin = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    successResponse(res, products, "Products fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) throw new AppError("Product not found", 404);

    successResponse(res, product, "Product fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Update product (ADMIN)
 * ❗ Type change not allowed if stock exists
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError("Product not found", 404);

    if (type && type !== product.type) {
      const stockExists = await prisma.stock.findFirst({
        where: { productId: id },
      });

      if (stockExists) {
        throw new AppError(
          "Product type cannot be changed once stock exists",
          400,
        );
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { name, type },
    });

    successResponse(res, updated, "Product updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * disable or Enable product (ADMIN)
 * ❗ Block if stock or bills exist
 */
export const disableEnableProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError("Product not found", 404);

    await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });

    successResponse(
      res,
      {},
      `Product ${product.isActive ? "disabled" : "Enable"} successfully`,
    );
  } catch (error) {
    next(error);
  }
};
