import prisma from "../database/prisma";
import { Prisma } from "@prisma/client";

const LOCK_KEY = "stock-transfer-no-seq";

export const generateTransferNo = async (
  tx?: Prisma.TransactionClient,
) => {
  const db = tx ?? prisma;

  // Serialize concurrent transfer creations so the read-then-insert sequence
  // cannot produce duplicate transfer numbers.
  if (tx) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;
  }

  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const lastTransfer = await db.stockTransfer.findFirst({
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