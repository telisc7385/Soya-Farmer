import prisma from "../database/prisma";

export const generateTransferNo = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const lastTransfer = await prisma.stockTransfer.findFirst({
    where: {
      transferNo: {
        startsWith: `TRF/${year}/${month}`,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let nextSeq = 1;

  if (lastTransfer) {
    const lastSeq = Number(lastTransfer.transferNo.split("/").pop());
    nextSeq = lastSeq + 1;
  }

  const seq = String(nextSeq).padStart(6, "0");

  return `TRF/${year}/${month}/${seq}`;
};
