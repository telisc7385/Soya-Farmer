import prisma from "../database/prisma";
import { BagMovementType } from "@prisma/client";

type CountByType = Record<string, number>;

type VendorBagSummary = {
  totals: {
    receivedFromFarmers: number;
    sentToAdmin: number;
    receivedFromAdmin: number;
    returnedToFarmers: number;
    currentWithVendor: number;
  };
  byType: Array<{
    goniTypeId: string;
    goniTypeName: string;
    receivedFromFarmers: number;
    sentToAdmin: number;
    receivedFromAdmin: number;
    returnedToFarmers: number;
    currentWithVendor: number;
  }>;
  returnedToFarmersByFarmer: Array<{
    farmer: { id: string; name: string; phone: string };
    bagCount: number;
  }>;
};

const emptySummary: VendorBagSummary = {
  totals: {
    receivedFromFarmers: 0,
    sentToAdmin: 0,
    receivedFromAdmin: 0,
    returnedToFarmers: 0,
    currentWithVendor: 0,
  },
  byType: [],
  returnedToFarmersByFarmer: [],
};

const addCount = (map: CountByType, key: string, count: number) => {
  map[key] = (map[key] ?? 0) + count;
};

const getTrackedType = async (goniTypeId?: string) => {
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

  const receivedFromFarmersRows = await prisma.bagMovement.findMany({
    where: {
      vendorId,
      goniTypeId: trackedId,
      movementType: BagMovementType.FARMER_TO_VENDOR,
    },
    select: {
      goniTypeId: true,
      bagCount: true,
    },
  });

  const vendorToAdminRows = await prisma.stockTransfer.findMany({
    where: {
      vendorId,
      status: "COMPLETED",
      goniTypeId: trackedId,
    },
    select: {
      goniTypeId: true,
      bagCount: true,
    },
  });

  const adminToVendorRows = await prisma.bagMovement.findMany({
    where: {
      vendorId,
      movementType: "ADMIN_TO_VENDOR",
      goniTypeId: trackedId,
    },
    select: {
      goniTypeId: true,
      bagCount: true,
    },
  });

  const vendorToFarmerRows = await prisma.bagMovement.findMany({
    where: {
      vendorId,
      movementType: "VENDOR_TO_FARMER",
      goniTypeId: trackedId,
    },
    select: {
      goniTypeId: true,
      bagCount: true,
      farmerId: true,
    },
  });

  const receivedFromFarmers: CountByType = {};
  const sentToAdmin: CountByType = {};
  const receivedFromAdmin: CountByType = {};
  const returnedToFarmers: CountByType = {};

  for (const row of receivedFromFarmersRows) {
    addCount(receivedFromFarmers, row.goniTypeId, row.bagCount);
  }
  for (const row of vendorToAdminRows) {
    if (!row.goniTypeId) continue;
    addCount(sentToAdmin, row.goniTypeId, row.bagCount);
  }
  for (const row of adminToVendorRows) {
    addCount(receivedFromAdmin, row.goniTypeId, row.bagCount);
  }
  for (const row of vendorToFarmerRows) {
    addCount(returnedToFarmers, row.goniTypeId, row.bagCount);
  }

  const receivedFarmer = receivedFromFarmers[trackedId] ?? 0;
  const receivedAdmin = receivedFromAdmin[trackedId] ?? 0;
  const sentAdmin = sentToAdmin[trackedId] ?? 0;
  const returnedFarmer = returnedToFarmers[trackedId] ?? 0;
  const currentWithVendor = Math.max(
    receivedFarmer + receivedAdmin - sentAdmin - returnedFarmer,
    0,
  );

  const returnedToFarmersByFarmerMap = vendorToFarmerRows.reduce<
    Record<string, number>
  >((acc, row) => {
    if (!row.farmerId) return acc;
    acc[row.farmerId] = (acc[row.farmerId] ?? 0) + row.bagCount;
    return acc;
  }, {});

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
        returnedToFarmers: returnedFarmer,
        currentWithVendor,
      },
    ],
    returnedToFarmersByFarmer,
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
