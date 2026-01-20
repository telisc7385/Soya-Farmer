import { Router } from "express";
import * as billController from "../controllers/bill.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  createBillSchema,
  addBillItemSchema,
} from "../validations/bill.validation";
import weighSlipsRoutes from "./weighSlip.routes";
import billDeductionsRoutes from "./billDeduction.routes";
import { finalizeBill } from "../controllers/billFinalize.controller";

const router = Router();

// Create bill (DRAFT)
router.post(
  "/",
  authMiddleware,
  validateRequest(createBillSchema),
  billController.createBill,
);

// Add item to bill
router.post(
  "/:billId/item",
  authMiddleware,
  validateRequest(addBillItemSchema),
  billController.addBillItem,
);

// Get bills
router.get("/", authMiddleware, billController.getBills);

// Get bill by ID
router.get("/:billId", authMiddleware, billController.getBillById);

// Get bill by ID
router.post("/:billId/finalize", authMiddleware, finalizeBill);

// weight Slips Routes
router.use("/weight-slips", authMiddleware, weighSlipsRoutes);

// Bill Deduction Routes
router.use("/deductions", authMiddleware, billDeductionsRoutes);

export default router;
