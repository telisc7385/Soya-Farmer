import { Router } from "express";
import * as stockController from "../controllers/stock.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import * as stockValidation from "../validations/stock.validation";

const router = Router();

// Get all stocks of logged-in vendor
router.get("/", authMiddleware, stockController.getVendorStocks);

// Transfer stock to admin
router.post(
  "/transfer-to-admin",
  authMiddleware,
  validateRequest(stockValidation.transferStockToAdminSchema),
  stockController.transferStockToAdmin,
);

export default router;
