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

    const vendorId = req.user?.id as string;

    // 🔍 check existing farmer with document count
    const existingFarmer = await prisma.farmer.findFirst({
      where: {
        OR: [{ phone }, { aadhaarNo }],
      },
      include: {
        _count: {
          select: { documents: true, banks: true },
        },
      },
    });

    if (
      existingFarmer &&
      existingFarmer._count.documents > 0 &&
      existingFarmer._count.banks > 0
    ) {
      console.log(
        "Existing Farmer DOc count:",
        existingFarmer?._count?.documents,
        existingFarmer?._count?.banks,
      );
      throw new AppError("Farmer already exists", 409);
    }

    let farmer;

    // ✅ create only if not exists
    if (!existingFarmer) {
      farmer = await prisma.farmer.create({
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
    } else {
      // reuse existing farmer (without _count)
      farmer = await prisma.farmer.findUnique({
        where: { id: existingFarmer.id },
      });
    }

    // 🔗 vendor-farmer mapping
    await prisma.vendorFarmer.upsert({
      where: {
        vendorId_farmerId: {
          vendorId,
          farmerId: farmer!.id,
        },
      },
      update: {},
      create: {
        vendorId,
        farmerId: farmer!.id,
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

export const checkDocumentsExistence = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    await checkFarmer(farmerId);

    const docCount = await prisma.farmerDocument.count({
      where: { farmerId },
    });

    if (docCount > 0) {
      throw new AppError("Documents already exist for this farmer", 400);
    }

    next();
  } catch (error) {
    throw new AppError((error as Error).message, 400);
  }
};

const REQUIRED_DOCS = ["AADHAAR", "PAN", "DRIVING_LICENSE"] as const;

export const addFarmerAllDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.body;
    const files = req.files as Record<string, Express.Multer.File[]>;

    if (!files) {
      throw new AppError("All documents are required", 400);
    }

    // 🔒 Ensure all required docs are present
    for (const doc of REQUIRED_DOCS) {
      if (!files[doc] || files[doc].length === 0) {
        throw new AppError(`${doc} document is required`, 400);
      }
    }

    await checkFarmer(farmerId);

    const data = REQUIRED_DOCS.map((type) => ({
      farmerId,
      type,
      imageUrl: `/uploads/farmers/documents/${files[type][0].filename}`,
    }));

    const createdDocs = await prisma.farmerDocument.createMany({
      data,
    });

    createdResponse(res, createdDocs, "All documents uploaded successfully");
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
    if (landType === "OWN") {
      const existingOwnedLand = await prisma.farmerLand.findFirst({
        where: { farmerId, landType: "OWN" },
      });
      if (existingOwnedLand) {
        throw new AppError("Farmer already has an owned land", 400);
      }
    }

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

    if (!req.file) {
      throw new AppError("Document image is required", 400);
    }

    await checkFarmer(farmerId);

    const passbookImage = `/uploads/farmers/documents/${req.file.filename}`;

    const existingBank = await prisma.farmerBank.findFirst({
      where: { farmerId, accountNo },
    });

    if (existingBank) {
      throw new AppError("Bank account already exists for this farmer", 400);
    }

    const bank = await prisma.farmerBank.create({
      data: {
        farmerId,
        bankName,
        accountNo,
        ifsc,
        holderName,
        isPrimary,
        passbookImage,
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
    const { bankName, accountNo, ifsc, holderName } = req.body;
    let passbookImage;

    if (req.file) {
      passbookImage = `/uploads/farmers/documents/${req.file.filename}`;
    }

    const bank = await prisma.farmerBank.update({
      where: { id: bankId, farmerId },
      data: {
        bankName,
        accountNo,
        ifsc,
        holderName,
        ...(passbookImage && { passbookImage }),
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

    // 1️⃣ Get only KYC-complete farmer IDs
    const kycFarmers = await prisma.farmerDocument.groupBy({
      by: ["farmerId"],
      having: {
        farmerId: {
          _count: { gte: 1 },
        },
      },
    });

    const farmerIds = kycFarmers.map((f) => f.farmerId);

    // 2️⃣ Fetch paginated farmers
    const farmers = await prisma.farmer.findMany({
      where: {
        id: { in: farmerIds },
        ...(search && {
          OR: [
            { name: { contains: String(search), mode: "insensitive" } },
            { phone: { contains: String(search), mode: "insensitive" } },
          ],
        }),
      },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        banks: {
          select: {
            id: true,
            bankName: true,
            accountNo: true,
            ifsc: true,
            holderName: true,
            passbookImage: true,
          },
        },
        // 👇 fetch only FIRST vendor
        vendors: {
          take: 1,
          orderBy: { createdAt: "asc" }, // first linked vendor
          select: {
            vendor: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            documents: true,
            lands: true,
          },
        },
      },
    });

    const formattedFarmers = farmers.map(({ vendors, _count, ...farmer }) => ({
      ...farmer,
      vendorName: vendors?.[0]?.vendor?.name ?? null,
      totalKycDocuments: _count.documents,
      totalLands: _count.lands,
    }));

    const total = await prisma.farmer.count({
      where: { id: { in: farmerIds } },
    });

    successResponse(
      res,
      {
        farmers: formattedFarmers,
        total,
        page: Number(page),
        limit: take,
      },
      "KYC-complete farmers fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};
