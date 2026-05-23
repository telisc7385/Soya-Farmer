type TransferProofStage = "dispatch" | "receive";

export const buildTransferProofUrl = (
  transferNo: string,
  stage: TransferProofStage,
) => {
  const safeTransferNo = transferNo.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `/uploads/transfer-proofs/${safeTransferNo}-${stage}.pdf`;
};

export const enqueueTransferProofGeneration = (params: {
  transferId: string;
  transferNo: string;
  stage: TransferProofStage;
}) => {
  // Hook for background worker integration (BullMQ/SQS/etc).
  // Current behavior logs intent; worker can be attached later without API changes.
  console.info("transfer-proof:enqueue", params);
};
