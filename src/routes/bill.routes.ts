import { Router } from "express";
import * as billController from "../controllers/bill.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { saveBillSchema } from "../validations/bill.validation";
import { finalizeBill } from "../controllers/billFinalize.controller";

const router = Router();

// Create/Update bill with items, deductions, weigh slips (DRAFT)
router.post(
  "/save",
  authMiddleware,
  validateRequest(saveBillSchema),
  billController.saveBill,
);

// Get bills
router.get("/", authMiddleware, billController.getBills);

// Get bill by ID
router.get("/:billId", authMiddleware, billController.getBillById);

// Get bill by ID
router.post("/:billId/finalize", authMiddleware, finalizeBill);

export default router;
