import { Request, Response, NextFunction } from "express";
import { logWarn } from "../utils/logger";

export const routeNotFoundError = (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  logWarn(`404 ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};
