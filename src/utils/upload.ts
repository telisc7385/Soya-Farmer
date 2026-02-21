import fs from "fs";
import path from "path";

type UploadResult = {
  fileName: string;
  publicUrl: string;
  absolutePath: string;
};

const ensureDir = async (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
};

const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

export const saveUploadedFile = async (
  file: Express.Multer.File,
  relativeDir: string, // e.g. "farmers/documents"
): Promise<UploadResult> => {
  const baseDir = path.join(process.cwd(), "public", "uploads", relativeDir);
  await ensureDir(baseDir);

  const safeName = sanitizeFileName(file.originalname);
  const fileName = `${Date.now()}-${safeName}`;
  const absolutePath = path.join(baseDir, fileName);

  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    fileName,
    publicUrl: `/uploads/${relativeDir}/${fileName}`,
    absolutePath,
  };
};
