// src/controllers/location.controller.ts
import { Request, Response } from "express";
import prisma from "../database/prisma";
import { createdResponse, successResponse } from "../utils/response";

/**
 * CREATE Location (Admin)
 */
export const createLocation = async (req: Request, res: Response) => {
  const { name, quintalLimit } = req.body;

  const location = await prisma.location.create({
    data: { name, quintalLimit },
  });

  createdResponse(res, location, "Location Added Sucessfully");
};

/**
 * GET All Locations
 */
export const getLocations = async (_req: Request, res: Response) => {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: "desc" },
  });

  successResponse(res, locations, "Locations List Fetched Sucessfully");
};

/**
 * UPDATE Location (Admin)
 */
export const updateLocation = async (req: Request, res: Response) => {
  const { id } = req.params;

  const location = await prisma.location.update({
    where: { id },
    data: req.body,
  });

  successResponse(res, location, "Location Data Updated Sucessfully");
};
