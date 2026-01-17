import { AppError } from "../core/appError";
import prisma from "../database/prisma";

export const checkFarmer = async (farmerId: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
  });

  if (!farmer) {
    throw new AppError("Farmer Not Found", 404);
  }

  return farmer; // optional
};
