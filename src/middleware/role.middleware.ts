import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";
import { AppError } from "../core/appError";

export const authorize =
  (...allowedRoles: Array<"ADMIN" | "VENDOR">) =>
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("Access denied", 403);
    }

    next();
  };

export const requireMasterAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  if (req.user.role !== "ADMIN" || !req.user.isMasterAdmin) {
    throw new AppError("Master admin access required", 403);
  }

  next();
};
