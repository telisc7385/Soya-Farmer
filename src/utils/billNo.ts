import prisma from "../database/prisma";

export const generateBillNo = async (vendorId: string) => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const prefix = `TBSPL/BILL/${year}/${month}`;

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
