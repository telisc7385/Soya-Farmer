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

router.get("/list", authMiddleware, farmerControllers.getFarmers);
router.get("/list/non-kyc", authMiddleware, farmerControllers.getNonKycFarmers);
router.get("/:farmerId", authMiddleware, farmerControllers.getFarmerById);

router.put(
  "/update/:farmerId",
  authMiddleware,
  upload.single("profile"),
  farmerControllers.updateFarmer,
);

// Farmer Documents
router.post(
  "/documents/:farmerId",
  authMiddleware,
  upload.fields([
    { name: "AADHAAR", maxCount: 2 },
    { name: "PAN", maxCount: 2 },
    { name: "DRIVING_LICENSE", maxCount: 2 },
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
  upload.array("document", 2),
  farmerControllers.updateFarmerDocument,
);

// Farmer Lands
router.post(
  "/:farmerId/lands",
  authMiddleware,
  upload.array("land", 5),
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
  upload.array("land", 5),
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
