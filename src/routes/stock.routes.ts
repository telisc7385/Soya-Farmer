import { Router } from "express";
import * as stockController from "../controllers/stock.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import * as stockValidation from "../validations/stock.validation";

const router = Router();

// Vendor adds stock
router.post(
  "/add",
  authMiddleware,
  validateRequest(stockValidation.addStockSchema),
  stockController.addStock,
);

// Get all stocks of logged-in vendor
router.get("/", authMiddleware, stockController.getVendorStocks);

// Get stock by farmer
router.get(
  "/farmer/:farmerId",
  authMiddleware,
  stockController.getStocksByFarmer,
);

// Admin / Vendor adjustment (optional)
router.post(
  "/adjust",
  authMiddleware,
  validateRequest(stockValidation.adjustStockSchema),
  stockController.adjustStock,
);

export default router;
