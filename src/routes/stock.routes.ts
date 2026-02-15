import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import * as stockController from "../controllers/stock.controller";
import * as transferController from "../controllers/stockTransfer.controller";
import { createTransferSchema } from "../validations/stock.validation";

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

// Get all stocks (vendor's own)
router.get("/", authMiddleware, authorize("VENDOR"), stockController.getStocks);

// Get stock summary
router.get(
  "/summary",
  authMiddleware,
  authorize("VENDOR"),
  stockController.getStockSummary,
);

// Get stock by ID
router.get(
  "/:stockId",
  authMiddleware,
  authorize("VENDOR"),
  stockController.getStockById,
);

export default router;
