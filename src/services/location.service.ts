import fs from "fs";
import path from "path";
import prisma from "../database/prisma";

type LocationItem = {
  id: number;
  name: string;
  code: string;
};

type LocationsFile = {
  districts: LocationItem[];
  talukas: Record<string, LocationItem[]>;
  villages: Record<string, LocationItem[]>;
};

const JSON_PATH = path.join(
  process.cwd(),
  "maharashtra_locations_official.json",
);

let cache: LocationsFile | null = null;

const loadLocations = (): LocationsFile => {
  if (cache) return cache;
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  cache = JSON.parse(raw) as LocationsFile;
  return cache;
};

export const getDistricts = (): LocationItem[] => {
  return loadLocations().districts;
};

export const getTalukasByDistrict = (
  districtCode: string,
): LocationItem[] => {
  return loadLocations().talukas[districtCode] ?? [];
};

export const getOfficialVillagesByTaluka = (
  talukaCode: string,
): LocationItem[] => {
  return loadLocations().villages[talukaCode] ?? [];
};

export const isOfficialVillage = (
  talukaCode: string,
  villageName: string,
): boolean => {
  const normalized = villageName.trim().toLowerCase();
  return getOfficialVillagesByTaluka(talukaCode).some(
    (v) => v.name.toLowerCase() === normalized,
  );
};

export const addCustomVillage = async (data: {
  name: string;
  talukaCode: string;
  addedBy: string;
}) => {
  const official = isOfficialVillage(data.talukaCode, data.name);
  const existing = await prisma.customVillage.findFirst({
    where: {
      talukaCode: data.talukaCode,
      name: { equals: data.name.trim(), mode: "insensitive" },
    },
  });

  if (official) {
    return { official: true, created: false };
  }
  if (existing) {
    return { official: false, created: false, village: existing };
  }

  const village = await prisma.customVillage.create({
    data: {
      name: data.name.trim(),
      talukaCode: data.talukaCode,
      addedBy: data.addedBy,
    },
  });
  return { official: false, created: true, village };
};

export const getMergedVillagesByTaluka = async (talukaCode: string) => {
  const official = getOfficialVillagesByTaluka(talukaCode);
  const custom = await prisma.customVillage.findMany({
    where: { talukaCode },
    orderBy: { name: "asc" },
  });

  const officialMapped = official.map((v) => ({
    id: String(v.id),
    name: v.name,
    code: v.code,
    source: "official",
  }));
  const customMapped = custom.map((v) => ({
    id: v.id,
    name: v.name,
    code: "",
    source: "custom",
  }));

  return {
    official,
    custom,
    merged: [...officialMapped, ...customMapped],
  };
};
