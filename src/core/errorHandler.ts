import { Request, Response, NextFunction } from "express";
import { AppError } from "./appError";

export const errorHandler = (
  err: Error | AppError | any,
  req: Request,
  res: Response,
  _next: NextFunction, // ✅ REQUIRED
) => {
  const method = req.method;
  const path = req.originalUrl;

  // Short error message for logs
  const shortMessage =
    err instanceof AppError
      ? err.message
      : err.code
        ? `Prisma Error: ${err.code}`
        : err.message || "Unknown error";

  // 🧾 Console log (short & dynamic)
  console.error(`[ERROR] ${method} ${path} → ${shortMessage}`);

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
