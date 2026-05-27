import prisma from "../database/prisma";

export const getPurchaseLimitQtlPerHectare = async (): Promise<number> => {
  const fallback = Number(process.env.PURCHASE_LIMIT_QTL_PER_HECTARE ?? "12");
  const fallbackSafe = Number.isFinite(fallback) && fallback > 0 ? fallback : 12;

  try {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true, purchaseLimitQtlPerHectare: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { purchaseLimitQtlPerHectare: true },
    });

    if (!admin?.purchaseLimitQtlPerHectare || admin.purchaseLimitQtlPerHectare <= 0) {
      return fallbackSafe;
    }
    return admin.purchaseLimitQtlPerHectare;
  } catch {
    return fallbackSafe;
  }
};
