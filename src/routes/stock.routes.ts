import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import upload from "../middleware/multer.middleware";
import {
  validateQuery,
  validateRequest,
} from "../middleware/validateRequest.middleware";
import * as stockController from "../controllers/stock.controller";
import * as transferController from "../controllers/stockTransfer.controller";
import * as bagController from "../controllers/bag.controller";
import * as thappiController from "../controllers/thappi.controller";
import {
  listInventoryLocations,
} from "../controllers/inventoryLocation.controller";
import { listActiveQualityRates } from "../controllers/qualityRate.controller";
import {
  createTransferSchema,
  returnBagsToFarmerSchema,
  vendorAddOwnBagsSchema,
} from "../validations/stock.validation";
import {
  createThappiSchema,
  listThappiQuerySchema,
} from "../validations/thappi.validation";
import { listInventoryLocationQuerySchema } from "../validations/inventoryLocation.validation";

const router = Router();

// =====================
// VENDOR TRANSFER ROUTES
// =====================

// Create transfer request
router.post(
  "/transfers",
  authMiddleware,
  authorize("VENDOR"),
  validateRequest(createTransferSchema),
  transferController.createTransfer,
);

// Get vendor's transfers
router.get(
  "/transfers",
  authMiddleware,
  authorize("VENDOR"),
  transferController.getVendorTransfers,
);

// Get quality-wise rates
router.get(
  "/quality-rates",
  authMiddleware,
  authorize("VENDOR"),
  listActiveQualityRates,
);

// Get all stocks (vendor's own)
router.get("/", authMiddleware, authorize("VENDOR"), stockController.getStocks);

// Get stock summary
router.get(
  "/summary",
  authMiddleware,
  authorize("VENDOR"),
  stockController.getStockSummary,
);

// Get vendor bag summary (farmer/admin cycle)
router.get(
  "/bags/summary",
  authMiddleware,
  authorize("VENDOR"),
  bagController.getVendorBagSummary,
);

// Vendor returns bags to farmer
router.post(
  "/bags/return-to-farmer",
  authMiddleware,
  authorize("VENDOR"),
  validateRequest(returnBagsToFarmerSchema),
  bagController.returnBagsToFarmer,
);

// Vendor adds own tracked bags (opening stock)
router.post(
  "/bags/own-add",
  authMiddleware,
  authorize("VENDOR"),
  validateRequest(vendorAddOwnBagsSchema),
  bagController.vendorAddOwnBags,
);

// Get vendor return due to farmer
router.get(
  "/bags/return-due/:farmerId",
  authMiddleware,
  authorize("VENDOR"),
  bagController.getVendorReturnDueToFarmer,
);

const normalizeMultipartBody = (req: any, _res: any, next: any) => {
  if (req.body.bagBreakdown && typeof req.body.bagBreakdown === "string") {
    try { req.body.bagBreakdown = JSON.parse(req.body.bagBreakdown); } catch {}
  }
  if (req.body.weightQtl && typeof req.body.weightQtl === "string") {
    req.body.weightQtl = parseFloat(req.body.weightQtl);
  }
  if (req.body.moisture && typeof req.body.moisture === "string") {
    req.body.moisture = parseFloat(req.body.moisture);
  }
  if (req.body.fm && typeof req.body.fm === "string") {
    req.body.fm = parseFloat(req.body.fm);
  }
  if (req.body.damage && typeof req.body.damage === "string") {
    req.body.damage = parseFloat(req.body.damage);
  }
  next();
};

router.post(
  "/thappis",
  authMiddleware,
  authorize("VENDOR"),
  upload.single("image"),
  normalizeMultipartBody,
  validateRequest(createThappiSchema),
  thappiController.createThappi,
);

router.get(
  "/thappis",
  authMiddleware,
  authorize("VENDOR"),
  validateQuery(listThappiQuerySchema),
  thappiController.getVendorThappis,
);

router.get(
  "/locations",
  authMiddleware,
  authorize("VENDOR"),
  validateQuery(listInventoryLocationQuerySchema),
  listInventoryLocations,
);

// Get stock by ID
router.get(
  "/:stockId",
  authMiddleware,
  authorize("VENDOR"),
  stockController.getStockById,
);

export default router;
