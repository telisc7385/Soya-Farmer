import multer from "multer";
import { AppError } from "../core/appError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB file size limit
  },
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/x-pdf";
    const isBitmap =
      file.mimetype === "image/bmp" ||
      file.mimetype === "image/x-bmp" ||
      file.mimetype === "image/x-windows-bmp";

    if (!isImage && !isPdf && !isBitmap) {
      return cb(
        new AppError("Only image, PDF, or bitmap files are allowed", 400),
      );
    }

    cb(null, true);
  },
});

export default upload;
