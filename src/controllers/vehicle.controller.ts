// src/controllers/vehicle.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";
import { AppError } from "../core/appError";

/**
 * CREATE VEHICLE (ADMIN)
 */
export const createVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { vehicleNo } = req.body;

    const exists = await prisma.vehicle.findUnique({
      where: { vehicleNo },
    });

    if (exists) {
      throw new AppError("Vehicle already exists", 409);
    }

    const vehicle = await prisma.vehicle.create({
      data: { vehicleNo },
    });

    createdResponse(res, vehicle, "Vehicle created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET ALL VEHICLES
 */
export const getVehicles = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: "desc" },
    });

    successResponse(res, vehicles, "Vehicles fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET VEHICLE BY ID
 */
export const getVehicleById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    successResponse(res, vehicle, "Vehicle fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * UPDATE VEHICLE
 */
export const updateVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { vehicleNo } = req.body;

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: { vehicleNo },
    });

    successResponse(res, vehicle, "Vehicle updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE VEHICLE (RESTRICTED)
 */
export const deleteVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const billCount = await prisma.bill.count({
      where: { vehicleId: id },
    });

    if (billCount > 0) {
      throw new AppError(
        "Vehicle cannot be deleted because it is used in bills",
        400,
      );
    }

    await prisma.vehicle.delete({
      where: { id },
    });

    successResponse(res, null, "Vehicle deleted successfully");
  } catch (error) {
    next(error);
  }
};
