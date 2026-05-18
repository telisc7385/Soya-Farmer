import prisma from "../database/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../core/appError";
import { createdResponse, successResponse } from "../utils/response";
import { Response, NextFunction, Request } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { checkFarmer } from "../repositories/checkFarmer.repository";
import { saveUploadedFile } from "../utils/upload";

const requireKycEditable = async (farmerId: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { id: true, kycStatus: true },
  });
  if (!farmer) throw new AppError("Farmer not found", 404);
  if (farmer.kycStatus !== "NOT_SUBMITTED" && farmer.kycStatus !== "REJECTED") {
    throw new AppError(
      `KYC is ${farmer.kycStatus}. Editing only allowed when status is NOT_SUBMITTED or REJECTED.`,
      400,
    );
  }
};

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
      panNo,
      email,
      villageAdd,
      gutNumber,
      taluka,
      district,
    } = req.body;

    const vendorId = req.user?.id as string;

    // 🔍 check existing farmer with document count
    const existingFarmer = await prisma.farmer.findFirst({
      where: { aadhaarNo },
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
    let profileUrl;
    if (req.file) {
      const uploaded = await saveUploadedFile(req.file, "farmers/profile");
      profileUrl = uploaded.publicUrl;
    }

    if (!existingFarmer) {
      farmer = await prisma.farmer.create({
        data: {
          name,
          phone,
          aadhaarNo,
          panNo,
          email,
          villageAdd,
          gutNumber,
          taluka,
          district,
          kycStatus: "NOT_SUBMITTED",
          ...(profileUrl && { profileUrl }),
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
        lands: true,
        vendors: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
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
    const { name, phone, villageAdd, district, taluka, gutNumber } =
      req.body || {};
    let profileUrl: string | undefined;

    if (req.file) {
      const uploaded = await saveUploadedFile(req.file, "farmers/profile");
      profileUrl = uploaded.publicUrl;
    }

    await requireKycEditable(farmerId);

    const farmer = await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        name,
        phone,
        villageAdd,
        district,
        taluka,
        gutNumber,
        ...(profileUrl && { profileUrl }),
      },
    });

    successResponse(res, farmer, "Farmer updated successfully");
  } catch (error) {
    next(error);
  }
};

// =====================
// ADMIN KYC VERIFICATION
// =====================
export const verifyFarmerKyc = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const adminId = req.user!.id;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { id: true, kycStatus: true },
    });
    if (!farmer) throw new AppError("Farmer not found", 404);
    if (farmer.kycStatus !== "PENDING_VERIFICATION") {
      throw new AppError(
        `KYC is ${farmer.kycStatus}. Only PENDING_VERIFICATION can be approved.`,
        400,
      );
    }

    const reKycDate = new Date();
    reKycDate.setFullYear(reKycDate.getFullYear() + 2);

    const updated = await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        kycStatus: "VERIFIED",
        kycVerifiedAt: new Date(),
        kycVerifiedById: adminId,
        kycRejectionReason: null,
        reKycDate,
        reKycStatus: "NOT_REQUIRED",
      },
    });

    successResponse(res, updated, "KYC verified successfully");
  } catch (error) {
    next(error);
  }
};

export const rejectFarmerKyc = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const { reason } = req.body;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { id: true, kycStatus: true },
    });
    if (!farmer) throw new AppError("Farmer not found", 404);
    if (farmer.kycStatus !== "PENDING_VERIFICATION") {
      throw new AppError(
        `KYC is ${farmer.kycStatus}. Only PENDING_VERIFICATION can be rejected.`,
        400,
      );
    }

    const updated = await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        kycStatus: "REJECTED",
        kycRejectionReason: reason || "KYC documents did not meet requirements",
      },
    });

    successResponse(res, updated, "KYC rejected");
  } catch (error) {
    next(error);
  }
};

export const getPendingKycFarmers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = "1", limit = "10", search } = req.query;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: Prisma.FarmerWhereInput = {
      kycStatus: "PENDING_VERIFICATION",
      ...(search && {
        OR: [
          { name: { contains: String(search), mode: "insensitive" } },
          { phone: { contains: String(search), mode: "insensitive" } },
          { aadhaarNo: { contains: String(search), mode: "insensitive" } },
        ],
      }),
    };

    const farmers = await prisma.farmer.findMany({
      where,
      skip,
      take,
      orderBy: { kycSubmittedAt: "asc" },
      include: {
        documents: true,
        banks: true,
        lands: true,
        vendors: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: {
            vendor: { select: { name: true } },
          },
        },
      },
    });

    const total = await prisma.farmer.count({ where });

    successResponse(
      res,
      {
        farmers,
        total,
        page: Number(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
      "Pending KYC farmers fetched",
    );
  } catch (error) {
    next(error);
  }
};

const REQUIRED_DOCS = ["AADHAAR"] as const;
const OPTIONAL_DOCS = ["PAN", "DRIVING_LICENSE"] as const;

export const addFarmerAllDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { farmerId } = req.params;
    const files = req.files as Record<string, Express.Multer.File[]>;

    if (!files) {
      throw new AppError("AADHAAR document is required", 400);
    }

    // 🔒 Ensure all required docs are present
    for (const doc of REQUIRED_DOCS) {
      if (!files[doc] || files[doc].length === 0) {
        throw new AppError(`${doc} document is required`, 400);
      }
    }

    await requireKycEditable(farmerId);

    // If resubmitting after rejection, delete old docs first
    const existingDocs = await prisma.farmerDocument.findMany({
      where: { farmerId },
      select: { id: true },
    });
    if (existingDocs.length > 0) {
      await prisma.farmerDocument.deleteMany({ where: { farmerId } });
    }

    const data = [];
    for (const type of REQUIRED_DOCS) {
      const { publicUrl } = await saveUploadedFile(
        files[type][0],
        "farmers/documents",
      );
      data.push({
        farmerId,
        type,
        imageUrl: publicUrl,
      });
    }

    for (const type of OPTIONAL_DOCS) {
      if (!files[type] || files[type].length === 0) continue;

      const { publicUrl } = await saveUploadedFile(
        files[type][0],
        "farmers/documents",
      );
      data.push({
        farmerId,
        type,
        imageUrl: publicUrl,
      });
    }

    await prisma.farmerDocument.createMany({ data });

    // Set KYC to pending verification
    await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        kycStatus: "PENDING_VERIFICATION",
        kycSubmittedAt: new Date(),
      },
    });

    createdResponse(res, data, "All documents uploaded successfully");
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

    const existing = await prisma.farmerDocument.findUnique({
      where: { id: documentId },
      select: { farmerId: true },
    });
    if (!existing) throw new AppError("Document not found", 404);
    await requireKycEditable(existing.farmerId);

    const { publicUrl: imageUrl } = await saveUploadedFile(
      req.file,
      "farmers/documents",
    );

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
    const { landType, area, villageAdd, taluka, district } = req.body;

    if (!req.file) {
      throw new AppError("Land document is required", 400);
    }

    // await requireKycEditable(farmerId);
    if (landType === "OWN") {
      const existingOwnedLand = await prisma.farmerLand.findFirst({
        where: { farmerId, landType: "OWN" },
      });
      if (existingOwnedLand) {
        throw new AppError("Farmer already has an owned land", 400);
      }
    }

    const { publicUrl: documentUrl } = await saveUploadedFile(
      req.file,
      "farmers/lands",
    );

    const land = await prisma.farmerLand.create({
      data: {
        farmerId,
        landType,
        area: Number(area),
        documentUrl,
        villageAdd,
        taluka,
        district,
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
    const { area, villageAdd, taluka, district } = req.body;

    const existingLand = await prisma.farmerLand.findUnique({
      where: { id: landId },
      select: { farmerId: true },
    });
    if (!existingLand) throw new AppError("Land not found", 404);
    // await requireKycEditable(existingLand.farmerId);

    const updateData: any = {};
    if (area) updateData.area = Number(area);
    if (villageAdd !== undefined) updateData.villageAdd = villageAdd;
    if (taluka !== undefined) updateData.taluka = taluka;
    if (district !== undefined) updateData.district = district;

    if (req.file) {
      const { publicUrl } = await saveUploadedFile(req.file, "farmers/lands");
      updateData.documentUrl = publicUrl;
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
    const { bankName, accountNo, ifsc, holderName } = req.body;

    if (!req.file) {
      throw new AppError("Document image is required", 400);
    }

    // await requireKycEditable(farmerId);

    const { publicUrl: passbookImage } = await saveUploadedFile(
      req.file,
      "farmers/bank",
    );

    const existingBank = await prisma.farmerBank.findFirst({
      where: { farmerId, accountNo },
    });

    if (existingBank) {
      throw new AppError("Bank account already exists for this farmer", 400);
    }

    await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        kycStatus: "PENDING_VERIFICATION",
        kycSubmittedAt: new Date(),
      },
    });

    const bank = await prisma.farmerBank.create({
      data: {
        farmerId,
        bankName,
        accountNo,
        ifsc,
        holderName,
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

    // await requireKycEditable(farmerId);

    if (req.file) {
      const { publicUrl } = await saveUploadedFile(req.file, "farmers/bank");
      passbookImage = publicUrl;
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
    const { page = "1", limit = "10", search, vendorId } = req.query;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const farmers = await prisma.farmer.findMany({
      where: {
        kycStatus: "VERIFIED",
        ...(vendorId && {
          vendors: {
            some: { vendorId: String(vendorId), isActive: true },
          },
        }),
        ...(search && {
          OR: [
            { name: { contains: String(search), mode: "insensitive" } },
            { phone: { contains: String(search), mode: "insensitive" } },
            { aadhaarNo: { contains: String(search), mode: "insensitive" } },
            { taluka: { contains: String(search), mode: "insensitive" } },
            { district: { contains: String(search), mode: "insensitive" } },
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
      where: {
        kycStatus: "VERIFIED",
        ...(vendorId && {
          vendors: {
            some: { vendorId: String(vendorId), isActive: true },
          },
        }),
      },
    });

    successResponse(
      res,
      {
        farmers: formattedFarmers,
        total,
        page: Number(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
      "KYC-complete farmers fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};

// Get non-KYC-complete Farmers
export const getNonKycFarmers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = "1", limit = "10", search, vendorId } = req.query;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: Prisma.FarmerWhereInput = {
      kycStatus: { not: "VERIFIED" },
      ...(vendorId && {
        vendors: {
          some: { vendorId: String(vendorId), isActive: true },
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: String(search), mode: "insensitive" } },
          { phone: { contains: String(search), mode: "insensitive" } },
          { aadhaarNo: { contains: String(search), mode: "insensitive" } },
          { taluka: { contains: String(search), mode: "insensitive" } },
          { district: { contains: String(search), mode: "insensitive" } },
        ],
      }),
    };

    const farmers = await prisma.farmer.findMany({
      where,
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
        vendors: {
          take: 1,
          orderBy: { createdAt: "asc" },
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

    const total = await prisma.farmer.count({ where });

    successResponse(
      res,
      {
        farmers: formattedFarmers,
        total,
        page: Number(page),
        limit: take,
        pages: Math.ceil(total / take),
      },
      "Non-KYC-complete farmers fetched successfully",
    );
  } catch (error) {
    next(error);
  }
};
