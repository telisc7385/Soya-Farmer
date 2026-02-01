import { Request, Response, NextFunction } from "express";
import prisma from "../database/prisma";
import { verifyToken } from "../services/jwt.services";
import { AppError } from "../core/appError";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "ADMIN" | "VENDOR";
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Token missing", 401);
    }

    const token = authHeader.split(" ")[1];

    // 1️⃣ Verify JWT (this can throw)
    const decoded = verifyToken(token); // { userId, role }

    // 2️⃣ Fetch user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError("Invalid token", 401);
    }

    if (!user.isActive) {
      throw new AppError(
        "Your account is temporarily deactivated. Please contact support.",
        401,
      );
    }

    // 3️⃣ Attach trusted user to request
    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (error: any) {
    // JWT-specific errors
    if (
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError" ||
      error.name === "JsonWebTokenError"
    ) {
      throw new AppError("Invalid or expired token", 401);
    }
    throw new AppError(error.message, 401);
  }
};
