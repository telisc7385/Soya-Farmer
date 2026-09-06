import prisma from "../database/prisma";
import { BagMovementType, Prisma } from "@prisma/client";

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

export const getLedgerTypes = async (goniTypeId?: string) => {
  if (goniTypeId) {
    return prisma.goniType.findMany({
      where: { id: goniTypeId, isTracked: true, isActive: true },
      select: { id: true, name: true },
    });
  }

  return prisma.goniType.findMany({
    where: { isTracked: true, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
};

export const getVendorBagLedgerSummary = async (
  vendorId: string,
  goniTypeId?: string,
): Promise<VendorBagSummary> => {
  const trackedTypes = await getLedgerTypes(goniTypeId);
  if (!trackedTypes.length) return emptySummary;

  const trackedIds = trackedTypes.map((type) => type.id);

  const inTypes = (where: Prisma.BagMovementWhereInput) => ({ vendorId, goniTypeId: { in: trackedIds }, ...where });

  const [
    farmerToVendorRows,
    adminToVendorRows,
    vendorSelfAddRows,
    adminToVendorAddRows,
    vendorToFarmerRows,
    vendorToAdminRows,
  ] = await Promise.all([
    prisma.bagMovement.groupBy({
      by: ["goniTypeId"],
      where: inTypes({ movementType: BagMovementType.FARMER_TO_VENDOR }),
      _sum: { bagCount: true },
    }),

    prisma.bagMovement.findMany({
      where: inTypes({ movementType: BagMovementType.ADMIN_TO_VENDOR }),
      select: {
        goniTypeId: true,
        bagCount: true,
      },
    }),

    prisma.bagMovement.groupBy({
      by: ["goniTypeId"],
      where: inTypes({ movementType: BagMovementType.VENDOR_SELF_ADD }),
      _sum: { bagCount: true },
    }),

    prisma.bagMovement.groupBy({
      by: ["goniTypeId"],
      where: inTypes({ movementType: BagMovementType.ADMIN_TO_VENDOR_ADD }),
      _sum: { bagCount: true },
    }),

    prisma.bagMovement.findMany({
      where: inTypes({ movementType: BagMovementType.VENDOR_TO_FARMER }),
      select: {
        goniTypeId: true,
        farmerId: true,
        bagCount: true,
      },
    }),

    prisma.bagMovement.groupBy({
      by: ["goniTypeId"],
      where: inTypes({ movementType: BagMovementType.VENDOR_TO_ADMIN }),
      _sum: { bagCount: true },
    }),
  ]);

  const sumForType = (
    rows: Array<{ goniTypeId: string; _sum?: { bagCount: number | null } | null }>,
    typeId: string,
  ) =>
    rows.filter((row) => row.goniTypeId === typeId).reduce(
      (sum, row) => sum + (row._sum?.bagCount ?? 0),
      0,
    );

  const byType = trackedTypes.map((type) => {
    const receivedFromFarmers = sumForType(farmerToVendorRows, type.id);
    const sentToAdmin = sumForType(vendorToAdminRows, type.id);
    const receivedFromVendorSelf = sumForType(vendorSelfAddRows, type.id);
    const receivedAdminAdd = sumForType(adminToVendorAddRows, type.id);
    const receivedFromAdmin = adminToVendorRows
      .filter((row) => row.goniTypeId === type.id)
      .reduce((sum, row) => sum + row.bagCount, 0);
    const returnedToFarmers = vendorToFarmerRows
      .filter((row) => row.goniTypeId === type.id)
      .reduce((sum, row) => sum + row.bagCount, 0);

    return {
      goniTypeId: type.id,
      goniTypeName: type.name,
      receivedFromFarmers,
      sentToAdmin,
      receivedFromAdmin,
      receivedFromVendorSelf,
      receivedAdminAdd,
      returnedToFarmers,
      currentWithVendor: Math.max(
        receivedFromFarmers +
          receivedFromAdmin +
          receivedFromVendorSelf +
          receivedAdminAdd -
          sentToAdmin -
          returnedToFarmers,
        0,
      ),
    };
  });

  // vendor -> farmer tracking (across all tracked types)
  const returnedToFarmersByFarmerMap: Record<string, number> = {};

  for (const row of vendorToFarmerRows) {
    if (!row.farmerId) continue;
    returnedToFarmersByFarmerMap[row.farmerId] =
      (returnedToFarmersByFarmerMap[row.farmerId] ?? 0) + row.bagCount;
  }

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
      receivedFromFarmers: byType.reduce((s, r) => s + r.receivedFromFarmers, 0),
      sentToAdmin: byType.reduce((s, r) => s + r.sentToAdmin, 0),
      receivedFromAdmin: byType.reduce((s, r) => s + r.receivedFromAdmin, 0),
      receivedFromVendorSelf: byType.reduce((s, r) => s + r.receivedFromVendorSelf, 0),
      receivedAdminAdd: byType.reduce((s, r) => s + r.receivedAdminAdd, 0),
      returnedToFarmers: byType.reduce((s, r) => s + r.returnedToFarmers, 0),
      currentWithVendor: byType.reduce((s, r) => s + r.currentWithVendor, 0),
    },

    byType,
    returnedToFarmersByFarmer,

    // ADMIN -> VENDOR LIST (what you wanted)
    receivedFromAdminByAdmin: adminToVendorRows,
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
  const trackedTypes = await getLedgerTypes(goniTypeId);
  if (!trackedTypes.length) {
    return {
      goniTypeId: goniTypeId ?? "",
      goniTypeName: "",
      receivedFromFarmer: 0,
      returnedToFarmer: 0,
      returnDue: 0,
    };
  }

  const trackedIds = trackedTypes.map((type) => type.id);

  const [receivedAgg, returnedAgg] = await Promise.all([
    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        farmerId,
        goniTypeId: { in: trackedIds },
        movementType: BagMovementType.FARMER_TO_VENDOR,
      },
      _sum: { bagCount: true },
    }),
    prisma.bagMovement.aggregate({
      where: {
        vendorId,
        farmerId,
        goniTypeId: { in: trackedIds },
        movementType: BagMovementType.VENDOR_TO_FARMER,
      },
      _sum: { bagCount: true },
    }),
  ]);

  const receivedFromFarmer = receivedAgg._sum.bagCount ?? 0;
  const returnedToFarmer = returnedAgg._sum.bagCount ?? 0;
  const returnDue = Math.max(receivedFromFarmer - returnedToFarmer, 0);

  return {
    goniTypeId: goniTypeId ?? "",
    goniTypeName: goniTypeId ? trackedTypes[0].name : "All",
    receivedFromFarmer,
    returnedToFarmer,
    returnDue,
  };
};
