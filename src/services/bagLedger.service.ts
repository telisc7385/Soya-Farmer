import prisma from "../database/prisma";
import { BagMovementType } from "@prisma/client";

type CountByType = Record<string, number>;

type VendorBagSummary = {
  totals: {
    receivedFromFarmers: number;
    sentToAdmin: number;
    receivedFromAdmin: number;
    receivedFromVendorSelf: number;
    receivedAdminAdd: number;
    returnedToFarmers: number;
    currentWithVendor: number;
  };
  byType: Array<{
    goniTypeId: string;
    goniTypeName: string;
    receivedFromFarmers: number;
    sentToAdmin: number;
    receivedFromAdmin: number;
    receivedFromVendorSelf: number;
    receivedAdminAdd: number;
    returnedToFarmers: number;
    currentWithVendor: number;
  }>;
  returnedToFarmersByFarmer: Array<{
    farmer: { id: string; name: string; phone: string };
    bagCount: number;
  }>;
  receivedFromAdminByAdmin: Array<{
    goniTypeId: string;
    bagCount: number;
  }>;
};

const emptySummary: VendorBagSummary = {
  totals: {
    receivedFromFarmers: 0,
    sentToAdmin: 0,
    receivedFromAdmin: 0,
    receivedFromVendorSelf: 0,
    receivedAdminAdd: 0,
    returnedToFarmers: 0,
    currentWithVendor: 0,
  },
  byType: [],
  returnedToFarmersByFarmer: [],
  receivedFromAdminByAdmin: [],
};

export const getTrackedType = async (goniTypeId?: string) => {
  if (goniTypeId) {
    return prisma.goniType.findFirst({
      where: { id: goniTypeId, isTracked: true, isActive: true },
      select: { id: true, name: true },
    });
  }

  return prisma.goniType.findFirst({
    where: { isTracked: true, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
};

export const getVendorBagLedgerSummary = async (
  vendorId: string,
  goniTypeId?: string,
): Promise<VendorBagSummary> => {
  const trackedType = await getTrackedType(goniTypeId);
  if (!trackedType) return emptySummary;

  const trackedId = trackedType.id;

  const [
    farmerToVendor,
    adminToVendor,
    vendorSelfAdd,
    adminToVendorAdd,
    vendorToFarmer,
    vendorToAdmin,
  ] = await Promise.all([
    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        goniTypeId: trackedId,
        movementType: BagMovementType.FARMER_TO_VENDOR,
      },
      _sum: { bagCount: true },
    }),

    prisma.bagMovement.findMany({
      where: {
        vendorId,
        goniTypeId: trackedId,
        movementType: BagMovementType.ADMIN_TO_VENDOR,
      },
      select: {
        goniTypeId: true,
        bagCount: true,
      },
    }),

    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        goniTypeId: trackedId,
        movementType: BagMovementType.VENDOR_SELF_ADD,
      },
      _sum: { bagCount: true },
    }),

    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        goniTypeId: trackedId,
        movementType: BagMovementType.ADMIN_TO_VENDOR_ADD,
      },
      _sum: { bagCount: true },
    }),

    prisma.bagMovement.findMany({
      where: {
        vendorId,
        goniTypeId: trackedId,
        movementType: BagMovementType.VENDOR_TO_FARMER,
      },
      select: {
        farmerId: true,
        bagCount: true,
      },
    }),

    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        goniTypeId: trackedId,
        movementType: BagMovementType.VENDOR_TO_ADMIN,
      },
      _sum: { bagCount: true },
    }),
  ]);

  const receivedFarmer = farmerToVendor._sum.bagCount ?? 0;
  const sentAdmin = vendorToAdmin._sum.bagCount ?? 0;
  const receivedSelf = vendorSelfAdd._sum.bagCount ?? 0;
  const receivedAdminAdd = adminToVendorAdd._sum.bagCount ?? 0;

  // total admin -> vendor bags
  const receivedAdmin = adminToVendor.reduce(
    (sum, row) => sum + row.bagCount,
    0,
  );

  // vendor -> farmer tracking
  const returnedToFarmersByFarmerMap: Record<string, number> = {};
  let returnedFarmer = 0;

  for (const row of vendorToFarmer) {
    returnedFarmer += row.bagCount;

    if (!row.farmerId) continue;

    returnedToFarmersByFarmerMap[row.farmerId] =
      (returnedToFarmersByFarmerMap[row.farmerId] ?? 0) + row.bagCount;
  }

  const currentWithVendor = Math.max(
    receivedFarmer +
      receivedAdmin +
      receivedSelf +
      receivedAdminAdd -
      sentAdmin -
      returnedFarmer,
    0,
  );

  const farmerIds = Object.keys(returnedToFarmersByFarmerMap);

  const farmers = farmerIds.length
    ? await prisma.farmer.findMany({
        where: { id: { in: farmerIds } },
        select: { id: true, name: true, phone: true },
      })
    : [];

  const returnedToFarmersByFarmer = farmerIds.map((farmerId) => ({
    farmer: farmers.find((f) => f.id === farmerId) ?? {
      id: farmerId,
      name: "Unknown",
      phone: "",
    },
    bagCount: returnedToFarmersByFarmerMap[farmerId],
  }));

  return {
    totals: {
      receivedFromFarmers: receivedFarmer,
      sentToAdmin: sentAdmin,
      receivedFromAdmin: receivedAdmin,
      receivedFromVendorSelf: receivedSelf,
      receivedAdminAdd,
      returnedToFarmers: returnedFarmer,
      currentWithVendor,
    },

    byType: [
      {
        goniTypeId: trackedId,
        goniTypeName: trackedType.name,
        receivedFromFarmers: receivedFarmer,
        sentToAdmin: sentAdmin,
        receivedFromAdmin: receivedAdmin,
        receivedFromVendorSelf: receivedSelf,
        receivedAdminAdd,
        returnedToFarmers: returnedFarmer,
        currentWithVendor,
      },
    ],
    returnedToFarmersByFarmer,

    // ADMIN -> VENDOR LIST (what you wanted)
    receivedFromAdminByAdmin: adminToVendor,
  };
};

export const getVendorCurrentBagsForType = async (
  vendorId: string,
  goniTypeId: string,
) => {
  const summary = await getVendorBagLedgerSummary(vendorId, goniTypeId);
  const row = summary.byType.find((item) => item.goniTypeId === goniTypeId);
  return row?.currentWithVendor ?? 0;
};

export const isTrackedGoniType = async (goniTypeId: string) => {
  const goniType = await prisma.goniType.findFirst({
    where: { id: goniTypeId, isTracked: true, isActive: true },
    select: { id: true },
  });
  return Boolean(goniType);
};

export const getVendorReturnDueForFarmer = async (
  vendorId: string,
  farmerId: string,
  goniTypeId?: string,
) => {
  const trackedType = await getTrackedType(goniTypeId);
  if (!trackedType) {
    return {
      goniTypeId: goniTypeId ?? "",
      goniTypeName: "",
      receivedFromFarmer: 0,
      returnedToFarmer: 0,
      returnDue: 0,
    };
  }

  const trackedId = trackedType.id;

  const [receivedAgg, returnedAgg] = await Promise.all([
    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        farmerId,
        goniTypeId: trackedId,
        movementType: BagMovementType.FARMER_TO_VENDOR,
      },
      _sum: { bagCount: true },
    }),
    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        farmerId,
        goniTypeId: trackedId,
        movementType: BagMovementType.VENDOR_TO_FARMER,
      },
      _sum: { bagCount: true },
    }),
  ]);

  const receivedFromFarmer = receivedAgg._sum.bagCount ?? 0;
  const returnedToFarmer = returnedAgg._sum.bagCount ?? 0;
  const returnDue = Math.max(receivedFromFarmer - returnedToFarmer, 0);

  return {
    goniTypeId: trackedId,
    goniTypeName: trackedType.name,
    receivedFromFarmer,
    returnedToFarmer,
    returnDue,
  };
};
