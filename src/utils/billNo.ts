import prisma from "../database/prisma";

export const generateBillNo = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const lastBill = await prisma.bill.findFirst({
    where: {
      billNo: {
        startsWith: `TBSPL/BILL/${year}/${month}`,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let nextSeq = 1;

  if (lastBill) {
    const lastSeq = Number(lastBill.billNo.split("/").pop());
    nextSeq = lastSeq + 1;
  }

  const seq = String(nextSeq).padStart(6, "0");

  return `BILL/${year}/${month}/${seq}`;
};
