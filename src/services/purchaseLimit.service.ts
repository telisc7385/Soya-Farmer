import prisma from "../database/prisma";

export const getPurchaseLimitQtlPerHectare = async (): Promise<number> => {
  const fallback = Number(process.env.PURCHASE_LIMIT_QTL_PER_HECTARE ?? "12");
  const fallbackSafe = Number.isFinite(fallback) && fallback > 0 ? fallback : 12;

  try {
    const latest = await prisma.purchaseLimit.findFirst({
      orderBy: { createdAt: "desc" },
      select: { value: true },
    });

    if (!latest || !latest.value || latest.value <= 0) {
      return fallbackSafe;
    }
    return latest.value;
  } catch {
    return fallbackSafe;
  }
};