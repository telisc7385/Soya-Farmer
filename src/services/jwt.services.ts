import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  role: "ADMIN" | "VENDOR";
}

export const generateToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });
};

export const verifyToken = (token: string): AuthTokenPayload => {
  return jwt.verify(
    token,
    process.env.JWT_SECRET as string
  ) as AuthTokenPayload;
};
