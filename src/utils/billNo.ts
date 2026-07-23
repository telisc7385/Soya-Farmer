import prisma from "../database/prisma";

export const generateBillNo = async (vendorId: string) => {
  const now = new Date();
  const calendarYear = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Financial year: Apr–Mar. Apr–Dec → current year, Jan–Mar → previous year
  const fyYear = now.getMonth() + 1 >= 4 ? calendarYear : calendarYear - 1;
  const prefix = `TBSPL/BILL/${fyYear}-${fyYear + 1}/${month}`;

  // Global sequence
  const lastGlobalBill = await prisma.bill.findFirst({
    where: {
      billNo: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
  });

  let globalSeq = 1;
  if (lastGlobalBill) {
    globalSeq = Number(lastGlobalBill.billNo.split("/").pop()) + 1;
  }

  // Per-vendor sequence
  const lastVendorBill = await prisma.bill.findFirst({
    where: {
      vendorId,
      billNo: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
  });

  let vendorSeq = 1;
  if (lastVendorBill) {
    vendorSeq = lastVendorBill.vendorBillSeq + 1;
  }

  return {
    billNo: `${prefix}/${String(globalSeq).padStart(3, "0")}`,
    vendorBillSeq: vendorSeq,
  };
};
