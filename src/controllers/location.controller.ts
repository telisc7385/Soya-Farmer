import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../core/appError";
import { successResponse, createdResponse } from "../utils/response";
import {
  getDistricts,
  getTalukasByDistrict,
  addCustomVillage,
  getMergedVillagesByTaluka,
} from "../services/location.service";

export const getDistrictsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const districts = getDistricts();
    successResponse(res, districts, "Districts fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const getTalukasController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { districtCode } = req.params;
    const talukas = getTalukasByDistrict(districtCode);
    if (talukas.length === 0) {
      throw new AppError("District not found", 404);
    }
    successResponse(res, talukas, "Talukas fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const getVillagesController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { talukaCode } = req.params;
    const { merged } = await getMergedVillagesByTaluka(talukaCode);
    successResponse(res, merged, "Villages fetched successfully");
  } catch (error) {
    next(error);
  }
};

export const addVillageController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { talukaCode } = req.params;
    const { name } = req.body;
    const addedBy = req.user?.id;

    if (!addedBy) {
      throw new AppError("Unauthorized", 401);
    }

    const result = await addCustomVillage({
      name,
      talukaCode,
      addedBy,
    });

    if (result.official) {
      successResponse(
        res,
        { official: true },
        "Village already exists in the official list",
      );
      return;
    }

    if (result.created) {
      createdResponse(
        res,
        result.village,
        "Village added successfully",
      );
      return;
    }

    successResponse(
      res,
      result.village,
      "Village already exists",
    );
  } catch (error) {
    next(error);
  }
};
