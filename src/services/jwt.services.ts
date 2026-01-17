import jwt, { JwtPayload } from "jsonwebtoken";
import { envConfig } from "../config/jwt";

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  role: "ADMIN" | "VENDOR";
}

export const generateToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, envConfig.accessSecret, {
    expiresIn: "7d",
  });
};

export const verifyToken = (token: string): AuthTokenPayload => {
  return jwt.verify(
    token,
    envConfig.accessSecret
  ) as AuthTokenPayload;
};
