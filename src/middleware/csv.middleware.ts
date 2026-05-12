import multer from "multer";
import { AppError } from "../core/appError";

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".csv");

    if (!allowed) {
      return cb(new AppError("Only CSV files are allowed", 400));
    }

    cb(null, true);
  },
});

export default csvUpload;
