import { Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { successResponse } from "../utils/response";
import { AppError } from "../core/appError";
import { AuthRequest } from "../middleware/auth.middleware";

// =====================
// VENDOR STOCK MANAGEMENT
// =====================

/**
 * Get vendor's stock list with filters
 */
export const getStocks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { status, page = 1, limit = 20 } = req.query;

    const where: any = { vendorId };
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          bill: {
            select: {
              billNo: true,
              billDate: true,
              farmer: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
          goniType: true,
        },
      }),
      prisma.stock.count({ where }),
    ]);

    successResponse(
      res,
      {
        stocks,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      "Stocks fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get stock by ID
 */
export const getStockById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;
    const { stockId } = req.params;

    const stock = await prisma.stock.findFirst({
      where: {
        id: stockId,
        vendorId,
      },
      include: {
        bill: {
          include: {
            farmer: true,
            deductions: true,
          },
        },
        goniType: true,
      },
    });

    if (!stock) {
      throw new AppError("Stock not found", 404);
    }

    successResponse(res, stock, "Stock details fetched");
  } catch (error) {
    next(error);
  }
};

/**
 * Get stock summary for vendor dashboard
 */
export const getStockSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vendorId = req?.user?.id as string;

    const summary = await prisma.stock.groupBy({
      by: ["status"],
      where: { vendorId },
      _sum: {
        weight: true,
        bagCount: true,
      },
      _count: true,
    });

    const totalStock = await prisma.stock.aggregate({
      where: { vendorId, status: "AVAILABLE" },
      _sum: {
        weight: true,
        bagCount: true,
      },
    });

    successResponse(
      res,
      {
        summary,
        totalAvailable: totalStock._sum,
      },
      "Stock summary fetched",
    );
  } catch (error) {
    next(error);
  }
};
