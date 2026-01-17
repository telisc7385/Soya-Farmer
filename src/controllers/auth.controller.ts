import bcrypt from "bcrypt";
import { generateAccessToken } from "../utils/jwt";
import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { NextFunction, Request, Response } from "express";

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try{
    const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  successResponse(res, { token, user }, `${user.role} Login Sucessfully`)
  } catch(error) {
    next(error)
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try{
  const { phone, password, role, name, email } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
    },
  });

  createdResponse(res, user, "User registered successfully")
} catch(error) {
    next(error)
  }
};
