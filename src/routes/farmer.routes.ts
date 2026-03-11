// src/routes/farmer.routes.ts
import { Router } from "express";
import * as farmerControllers from "../controllers/farmer.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import * as farmerValidation from "../validations/farmer.validation";
import upload from "../middleware/multer.middleware";

const router = Router();

// Farmer Controllers
router.post(
  "/create-farmer",
  authMiddleware,
  upload.single("profile"),
  validateRequest(farmerValidation.createFarmerSchema),
  farmerControllers.createFarmer,
);

router.get("/list", farmerControllers.getFarmers);
router.get("/:farmerId", authMiddleware, farmerControllers.getFarmerById);

router.put("/update/:farmerId", authMiddleware, farmerControllers.updateFarmer);

// Farmer Documents
router.post(
  "/documents/:farmerId",
  authMiddleware,
  upload.fields([
    { name: "AADHAAR", maxCount: 1 },
    { name: "PAN", maxCount: 1 },
    { name: "DRIVING_LICENSE", maxCount: 1 },
  ]),
  farmerControllers.addFarmerAllDocuments,
);

router.get(
  "/document/:farmerId",
  authMiddleware,
  farmerControllers.getFarmerDocuments,
);
router.put(
  "/document/:documentId",
  authMiddleware,
  upload.single("document"),
  farmerControllers.updateFarmerDocument,
);

// Farmer Lands
router.post(
  "/:farmerId/lands",
  authMiddleware,
  upload.single("land"),
  validateRequest(farmerValidation.farmerLandSchema),
  farmerControllers.addFarmerLand,
);

router.get(
  "/:farmerId/lands",
  authMiddleware,
  farmerControllers.getFarmerLands,
);
router.put(
  "/land/:landId",
  authMiddleware,
  upload.single("land"),
  farmerControllers.updateFarmerLand,
);

router.post(
  "/:farmerId/bank",
  authMiddleware,
  upload.single("document"),
  validateRequest(farmerValidation.farmerBankSchema),
  farmerControllers.addFarmerBank,
);

router.get("/:farmerId/bank", authMiddleware, farmerControllers.getFarmerBanks);
router.put(
  "/:farmerId/bank/:bankId",
  authMiddleware,
  upload.single("document"),
  validateRequest(farmerValidation.farmerBankSchema),
  farmerControllers.updateFarmerBank,
);

export default router;
