import jwt from "jsonwebtoken";
import { envConfig } from "../config/env";

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "VENDOR";
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, envConfig.accessSecret, { expiresIn: "7d" });
}
