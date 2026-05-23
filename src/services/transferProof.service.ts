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

const escapePdfText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildMinimalPdf = (lines: string[]) => {
  const contentLines = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    ...lines.flatMap((line, idx) =>
      idx === 0
        ? [`(${escapePdfText(line)}) Tj`]
        : ["0 -16 Td", `(${escapePdfText(line)}) Tj`],
    ),
    "ET",
  ];
  const stream = contentLines.join("\n");
  const streamLen = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${streamLen} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
};

export const writeTransferProofPdf = async (params: {
  absolutePath: string;
  stage: TransferProofStage;
  transferNo: string;
  vendorName?: string;
  source?: string;
  destination?: string;
  vehicle?: string;
  weightQtl?: number | null;
  bagCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
  status?: string | null;
}) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(path.dirname(params.absolutePath), { recursive: true });

  const now = new Date().toISOString();
  const lines = [
    `Transfer Proof (${params.stage.toUpperCase()})`,
    `Transfer No: ${params.transferNo}`,
    `Generated At: ${now}`,
    `Vendor: ${params.vendorName ?? "-"}`,
    `Source: ${params.source ?? "-"}`,
    `Destination: ${params.destination ?? "-"}`,
    `Vehicle: ${params.vehicle ?? "-"}`,
    `Weight (QTL): ${params.weightQtl ?? 0}`,
    `Bags: ${params.bagCount ?? 0}`,
    `GPS: ${params.latitude ?? "-"}, ${params.longitude ?? "-"}`,
    `Location Text: ${params.locationText ?? "-"}`,
    `Status: ${params.status ?? "-"}`,
  ];
  const pdf = buildMinimalPdf(lines);
  await fs.writeFile(params.absolutePath, pdf);
};
