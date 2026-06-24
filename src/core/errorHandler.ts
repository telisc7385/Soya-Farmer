import { Request, Response, NextFunction } from "express";
import { AppError } from "./appError";
import { logError } from "../utils/logger";

export const errorHandler = (
  err: Error | AppError | any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const method = req.method;
  const path = req.originalUrl;

  const shortMessage =
    err instanceof AppError
      ? err.message
      : err.code
        ? `Prisma Error: ${err.code}`
        : err.message || "Unknown error";

  logError(`${method} ${path} → ${shortMessage}`);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err.code === "P2025") {
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
};
