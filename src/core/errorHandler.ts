import { Request, Response, NextFunction } from "express";
import { AppError } from "./appError";

export const errorHandler = (
  err: Error | AppError | any,
  _req: Request,
  res: Response,
  _next: NextFunction, // ✅ REQUIRED
) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err.code === "P2025") {
    // Prisma "Record not found" error
    res.status(404).json({
      success: false,
      message: "Record not found",
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
  return;
};
