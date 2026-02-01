import prisma from "../database/prisma";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { Response, NextFunction, Request } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { checkFarmer } from "../repositories/checkFarmer.repository";

// Farmer Controllers
export const createFarmer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      name,
      phone,
      aadhaarNo,
      email,
      villageAdd,
      gutNumber,
      taluka,
      district,
    } = req.body;
    const vendorId = req?.user?.id as string;

    const existingFarmer = await prisma.farmer.findFirst({
      where: {
        OR: [{ phone }, { aadhaarNo }],
      },
    });

    if (existingFarmer) {
      throw new AppError("Farmer already exists", 409);
    }

    const farmer = await prisma.farmer.create({
      data: {
        name,
        phone,
        aadhaarNo,
        email,
        villageAdd,
        gutNumber,
        taluka,
        district,
      },
    });

    // map farmer to vendor
    await prisma.vendorFarmer.create({
      data: {
        vendorId: vendorId,
        farmerId: farmer.id,
      },
    });

    createdResponse(res, farmer, "Farmer created successfully");
  } catch (error) {
    next(error);
  }
};

export const getFarmerById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      include: {
        banks: true,
        documents: true,
        lands: { include: { location: true } },
        vendors: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                isActive: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!farmer) {
      throw new AppError("Farmer not found", 404);
    }

    successResponse(res, farmer, "Farmer details fetched");
  } catch (error) {
    next(error);
  }
};

export const updateFarmer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const { name, phone } = req.body;

    await checkFarmer(farmerId);

    const farmer = await prisma.farmer.update({
      where: { id: farmerId },
      data: { name, phone },
    });

    successResponse(res, farmer, "Farmer updated successfully");
  } catch (error) {
    next(error);
  }
};

// Farmer Documents
export const addFarmerDocument = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId, type } = req.body;

    if (!req.file) {
      throw new AppError("Document image is required", 400);
    }

    await checkFarmer(farmerId);

    const imageUrl = `/uploads/farmers/documents/${req.file.filename}`;

    const doc = await prisma.farmerDocument.create({
      data: {
        farmerId,
        type,
        imageUrl,
      },
    });

    createdResponse(res, doc, "Farmer document uploaded");
  } catch (error) {
    next(error);
  }
};

export const getFarmerDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;

    await checkFarmer(farmerId);

    const documents = await prisma.farmerDocument.findMany({
      where: { farmerId },
    });

    successResponse(res, documents, "Farmer documents fetched");
  } catch (error) {
    next(error);
  }
};

export const updateFarmerDocument = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { documentId } = req.params;

    if (!req.file) {
      throw new AppError("Document file is required", 400);
    }

    const imageUrl = `/uploads/farmers/documents/${req.file.filename}`;

    const doc = await prisma.farmerDocument.update({
      where: { id: documentId },
      data: { imageUrl },
    });

    successResponse(res, doc, "Document updated successfully");
  } catch (error) {
    next(error);
  }
};

// Farmer Land
export const addFarmerLand = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const { locationId, landType, area } = req.body;

    if (!req.file) {
      throw new AppError("Land document is required", 400);
    }

    await checkFarmer(farmerId);

    const documentUrl = `/uploads/farmers/lands/${req.file.filename}`;

    const land = await prisma.farmerLand.create({
      data: {
        farmerId,
        locationId,
        landType,
        area: Number(area),
        documentUrl,
      },
    });

    createdResponse(res, land, "Farmer land added");
  } catch (error) {
    next(error);
  }
};

export const getFarmerLands = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;

    await checkFarmer(farmerId);

    const lands = await prisma.farmerLand.findMany({
      where: { farmerId },
      include: { location: true },
    });

    successResponse(res, lands, "Farmer lands fetched");
  } catch (error) {
    next(error);
  }
};

export const updateFarmerLand = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { landId } = req.params;
    const { area } = req.body;

    const updateData: any = {};
    if (area) updateData.area = Number(area);

    if (req.file) {
      updateData.documentUrl = `/uploads/farmers/lands/${req.file.filename}`;
    }

    const land = await prisma.farmerLand.update({
      where: { id: landId },
      data: updateData,
    });

    successResponse(res, land, "Farmer land updated");
  } catch (error) {
    next(error);
  }
};

// Farmer Bank Details Controller
export const addFarmerBank = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const { bankName, accountNo, ifsc, holderName, isPrimary } = req.body;

    await checkFarmer(farmerId);

    if (isPrimary) {
      await prisma.farmerBank.updateMany({
        where: {
          farmerId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const bank = await prisma.farmerBank.create({
      data: {
        farmerId,
        bankName,
        accountNo,
        ifsc,
        holderName,
        isPrimary,
      },
    });

    createdResponse(res, bank, "Farmer bank details added");
  } catch (error) {
    next(error);
  }
};

export const getFarmerBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;

    await checkFarmer(farmerId);

    const banks = await prisma.farmerBank.findMany({
      where: { farmerId },
    });

    successResponse(res, banks, "Farmer bank details fetched");
  } catch (error) {
    next(error);
  }
};

export const updateFarmerBank = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { bankId, farmerId } = req.params;
    const { bankName, accountNo, ifsc, holderName, isPrimary } = req.body;

    if (isPrimary) {
      await prisma.farmerBank.updateMany({
        where: {
          farmerId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const bank = await prisma.farmerBank.update({
      where: { id: bankId },
      data: {
        bankName,
        accountNo,
        ifsc,
        holderName,
        isPrimary,
      },
    });

    successResponse(res, bank, "Bank details updated");
  } catch (error) {
    next(error);
  }
};

// Get all Farmers
export const getFarmers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = "1", limit = "10", search } = req.query;

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    // Build where clause
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { phone: { contains: String(search), mode: "insensitive" } },
      ];
    }

    // Fetch farmers
    const farmers = await prisma.farmer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        banks: true,
        documents: true,
        lands: {
          include: {
            location: true,
          },
        },
      },
    });

    // Total count for pagination
    const total = await prisma.farmer.count({ where });

    successResponse(
      res,
      {
        farmers,
        total,
        page: Number(page),
        limit: take,
      },
      "Farmers fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};
