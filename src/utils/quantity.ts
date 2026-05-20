export type TransferUnit = "QTL" | "MT";

const QTL_PER_MT = 10;

export const toQtl = (
  value: number,
  unit: TransferUnit | null | undefined,
): number => {
  if (!Number.isFinite(value)) return 0;
  if (unit === "MT") return value * QTL_PER_MT;
  return value;
};

export const fromQtl = (valueQtl: number, unit: TransferUnit): number => {
  if (!Number.isFinite(valueQtl)) return 0;
  if (unit === "MT") return valueQtl / QTL_PER_MT;
  return valueQtl;
};
