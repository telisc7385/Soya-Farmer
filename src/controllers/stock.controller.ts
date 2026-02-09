import { Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";

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

// Manual Stock Adjustment (Admin / Vendor)

// Transfer vendor stock to admin
export const transferStockToAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { stockId, quantity } = req.body;

    if (quantity <= 0) throw new AppError("Quantity must be positive", 400);

    const stock = await prisma.stock.findFirst({
      where: { id: stockId, vendorId },
      include: { product: true },
    });
    if (!stock) throw new AppError("Stock not found", 404);
    if (stock.quantity < quantity) {
      throw new AppError("Insufficient stock", 400);
    }

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
    });
    if (!admin) throw new AppError("Admin not found", 404);

    const result = await prisma.$transaction(async (tx) => {
      const updatedVendorStock = await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: quantity } },
      });

      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: "OUT",
          quantity,
          reference: `TRANSFER_TO_ADMIN:${admin.id}`,
        },
      });

      let adminStock = await tx.stock.findFirst({
        where: {
          vendorId: admin.id,
          farmerId: stock.farmerId,
          productId: stock.productId,
        },
      });

      if (!adminStock) {
        adminStock = await tx.stock.create({
          data: {
            vendorId: admin.id,
            farmerId: stock.farmerId,
            productId: stock.productId,
            quantity,
          },
        });
      } else {
        adminStock = await tx.stock.update({
          where: { id: adminStock.id },
          data: { quantity: { increment: quantity } },
        });
      }

      await tx.stockMovement.create({
        data: {
          stockId: adminStock.id,
          type: "IN",
          quantity,
          reference: `TRANSFER_FROM_VENDOR:${vendorId}`,
        },
      });

      // Update vendor/admin total summaries
      await tx.user.update({
        where: { id: vendorId },
        data: {
          totalKattaStock: { decrement: quantity },
          totalSoyaKg: { decrement: quantity },
        },
      });
      await tx.user.update({
        where: { id: admin.id },
        data: {
          totalKattaStock: { increment: quantity },
          totalSoyaKg: { increment: quantity },
        },
      });

      return { updatedVendorStock, adminStock };
    });

    successResponse(res, result, "Stock transferred to admin");
  } catch (error) {
    next(error);
  }
};
