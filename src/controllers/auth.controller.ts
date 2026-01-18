import bcrypt from "bcrypt";
import { generateAccessToken } from "../utils/jwt";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { NextFunction, Request, Response } from "express";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
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
    const { phone, password, role = "VENDOR", name, email } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role,
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
    const { phone, name } = req.body;

    // Check if vendor exists
    const existingVendor = await prisma.user.findUnique({ where: { id } });
    if (!existingVendor) {
      throw new AppError("Vendor not found", 404);
    }

    // Update vendor
    const updatedVendor = await prisma.user.update({
      where: { id },
      data: { name, phone },
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
    // Get query parameters with defaults
    const { page = "1", limit = "10", search, isActive } = req.query;

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    // Build the "where" clause
    const where: any = {
      role: "VENDOR",
    };

    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { email: { contains: String(search), mode: "insensitive" } },
        { phone: { contains: String(search), mode: "insensitive" } },
      ];
    }

    // Add isActive filter if provided
    if (isActive !== undefined) {
      // Convert string "true"/"false" to boolean
      where.isActive = isActive === "true";
    }

    // Fetch vendors with pagination
    const vendors = await prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Get total count for pagination
    const total = await prisma.user.count({ where });

    // Send success response
    successResponse(
      res,
      {
        vendors,
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
