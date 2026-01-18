import { Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";

export const addStock = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { farmerId, productId, quantity } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || !product.isActive) {
      throw new AppError("Product is inactive or not found", 400);
    }

    let stock = await prisma.stock.findUnique({
      where: {
        vendorId_farmerId_productId: {
          vendorId,
          farmerId,
          productId,
        },
      },
    });

    if (!stock) {
      stock = await prisma.stock.create({
        data: {
          vendorId,
          farmerId,
          productId,
          quantity,
        },
      });
    } else {
      stock = await prisma.stock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity + quantity },
      });
    }

    await prisma.stockMovement.create({
      data: {
        stockId: stock.id,
        type: "IN",
        quantity,
      },
    });

    createdResponse(res, stock, "Stock added successfully");
  } catch (error) {
    next(error);
  }
};

// get Stocks
export const getVendorStocks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;

    const stocks = await prisma.stock.findMany({
      where: { vendorId },
      include: {
        farmer: true,
        product: true,
      },
    });

    successResponse(res, stocks, "Stocks fetched successfully");
  } catch (error) {
    next(error);
  }
};

// Get Stocks by Farmer
export const getStocksByFarmer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { farmerId } = req.params;

    const stocks = await prisma.stock.findMany({
      where: {
        vendorId,
        farmerId,
      },
      include: {
        product: true,
      },
    });

    successResponse(res, stocks, "Farmer stocks fetched");
  } catch (error) {
    next(error);
  }
};

// Manual Stock Adjustment (Admin / Vendor)
export const adjustStock = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { stockId, quantity, reason } = req.body;

    const stock = await prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) throw new AppError("Stock not found", 404);

    const updatedQty = stock.quantity + quantity;
    if (updatedQty < 0) {
      throw new AppError("Stock cannot be negative", 400);
    }

    const updatedStock = await prisma.stock.update({
      where: { id: stockId },
      data: { quantity: updatedQty },
    });

    await prisma.stockMovement.create({
      data: {
        stockId,
        type: "ADJUSTMENT",
        quantity,
        reference: reason,
      },
    });

    successResponse(res, updatedStock, "Stock adjusted successfully");
  } catch (error) {
    next(error);
  }
};
