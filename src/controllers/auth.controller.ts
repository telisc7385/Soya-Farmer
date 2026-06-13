import bcrypt from "bcrypt";
import { generateAccessToken } from "../utils/jwt";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { NextFunction, Request, Response } from "express";
import { BagMovementType } from "@prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password, role = "VENDOR" } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone: email }],
        role,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    const { password: _, ...safeUser } = user;

    successResponse(res, { token, safeUser }, `${user.role} Login Sucessfully`);
  } catch (error) {
    next(error);
  }
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      phone,
      password,
      role = "VENDOR",
      name,
      email,
      vendorRate,
      villageAdd,
      taluka,
      district,
      factoryRateDiff,
      masterVendor = false,
      grnNumber,
    } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Phone";
      throw new AppError(`${field} already registered`, 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        villageAdd,
        taluka,
        district,
        password: hashedPassword,
        role,
        factoryRateDiff,
        masterVendor,
        grnNumber,
        ...(vendorRate !== undefined ? { vendorRate } : {}),
      },
    });

    const { password: _, ...safeUser } = user;

    createdResponse(
      res,
      safeUser,
      `${role === "VENDOR" ? "Vendor" : "Admin"} Created successfully`,
    );
  } catch (error) {
    next(error);
  }
};

export const updateVendor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // vendor id
    const {
      phone,
      name,
      villageAdd,
      taluka,
      district,
      vendorRate,
      password,
      factoryRateDiff,
      masterVendor = false,
      grnNumber,
    } = req.body;

    // Check if vendor exists
    const existingVendor = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existingVendor || existingVendor.role !== "VENDOR") {
      throw new AppError("Vendor not found", 404);
    }

    let hashedPassword: string | undefined = undefined;

    if (password) {
      // Hash new password if provided
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Update vendor
    const updatedVendor = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        villageAdd,
        taluka,
        district,
        factoryRateDiff,
        masterVendor,
        grnNumber,
        ...(hashedPassword !== undefined ? { password: hashedPassword } : {}),
        ...(vendorRate !== undefined ? { vendorRate } : {}),
      },
    });

    // Remove password from response
    const { password: _, ...safeVendor } = updatedVendor;

    successResponse(res, safeVendor, "Vendor updated successfully");
  } catch (error) {
    next(error);
  }
};

export const updateVendorStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const existingVendor = await prisma.user.findUnique({ where: { id } });
    if (!existingVendor) {
      throw new AppError("Vendor not found", 404);
    }

    const updatedVendor = await prisma.user.update({
      where: { id },
      data: { isActive: !existingVendor.isActive },
    });

    const { password: _, ...safeVendor } = updatedVendor;

    successResponse(res, safeVendor, "Vendor status updated successfully");
  } catch (error) {
    next(error);
  }
};

export const getVendorList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = "1",
      limit = "10",
      search,
      isActive,
      sort = "desc",
      sortBy = "createdAt",
    } = req.query;

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {
      role: "VENDOR",
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { email: { contains: String(search), mode: "insensitive" } },
        { phone: { contains: String(search), mode: "insensitive" } },
      ];
    }

    // Active filter
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    // Sorting
    const allowedSortFields = ["name", "createdAt", "vendorRate", "email"];

    const orderBy: any = allowedSortFields.includes(String(sortBy))
      ? { [String(sortBy)]: sort === "asc" ? "asc" : "desc" }
      : { createdAt: "desc" };

    //  Parallel queries
    const [vendors, total, qualityRatesResponse] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          factoryRateDiff: true,
          grnNumber: true,
          villageAdd: true,
          taluka: true,
          district: true,
          isActive: true,
          createdAt: true,
          masterVendor: true,
        },
      }),
      prisma.user.count({ where }),
      prisma.qualityRate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: { quality: true, rate: true },
      }),
    ]);

    const vendorIds = vendors.map((v) => v.id);

    // Aggregate bag movements
    const bagData = await prisma.bagMovement.groupBy({
      by: ["vendorId", "movementType"],
      where: {
        vendorId: { in: vendorIds },
      },
      _sum: {
        bagCount: true,
      },
    });

    // Structured bag map
    const bagMap: Record<
      string,
      {
        openingBagsAdded: number;
        totalReceived: number;
        totalReturned: number;
      }
    > = {};

    for (const item of bagData) {
      const key = item.vendorId;

      if (!bagMap[key]) {
        bagMap[key] = {
          openingBagsAdded: 0,
          totalReceived: 0,
          totalReturned: 0,
        };
      }

      const count = item._sum.bagCount || 0;

      // ✅ Opening bags (ONLY this type)
      if (item.movementType === BagMovementType.ADMIN_TO_VENDOR_ADD) {
        bagMap[key].openingBagsAdded += count;
        bagMap[key].totalReceived += count;
      }

      // ✅ Other incoming
      else if (
        item.movementType === BagMovementType.ADMIN_TO_VENDOR ||
        item.movementType === BagMovementType.FARMER_TO_VENDOR
      ) {
        bagMap[key].totalReceived += count;
      }

      // ❌ Outgoing
      else if (
        item.movementType === BagMovementType.VENDOR_TO_ADMIN ||
        item.movementType === BagMovementType.VENDOR_TO_FARMER ||
        item.movementType === BagMovementType.VENDOR_SELF_ADD
      ) {
        bagMap[key].totalReturned += count;
      }
    }

    console.log("Bag Map:", bagMap);

    // Final response mapping
    const vendorsWithFactoryRate = vendors.map((vendor) => {
      const stats = bagMap[vendor.id] || {
        openingBagsAdded: 0,
        totalReceived: 0,
        totalReturned: 0,
      };

      const remainingBags = stats.totalReceived - stats.totalReturned;

      return {
        ...vendor,
        actualFactoryRate: qualityRatesResponse?.rate || 0,
        vendorRate: (qualityRatesResponse?.rate || 0) + vendor.factoryRateDiff,

        // ✅ All required fields
        openingBagsAdded: stats.openingBagsAdded,
        totalReceived: stats.totalReceived,
        totalReturned: stats.totalReturned,
        remainingBags,
      };
    });

    successResponse(
      res,
      {
        vendors: vendorsWithFactoryRate,
        total,
        page: Number(page),
        limit: take,
      },
      "Vendor list fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

export const getVendorById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.user.findFirst({
      where: { id, role: "VENDOR" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        vendorRate: true,
        grnNumber: true,
        villageAdd: true,
        taluka: true,
        district: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!vendor) throw new AppError("Vendor not found", 404);

    successResponse(res, vendor, "Vendor fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const adminResetPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError("Unauthorized", 401);

    const { oldPassword, newPassword } = req.body;

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true, password: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      throw new AppError("Admin user not found", 404);
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      throw new AppError("Old password is incorrect", 400);
    }

    if (oldPassword === newPassword) {
      throw new AppError("New password must be different from old password", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword },
    });

    successResponse(res, null, "Admin password reset successfully");
  } catch (error) {
    next(error);
  }
};
