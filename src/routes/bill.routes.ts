import { Router } from "express";
import * as billController from "../controllers/billing/bill.controller";
import * as billingFlow from "../controllers/billing/billing.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import upload from "../middleware/multer.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  applyGoniSchema,
  calculateDeductionSchema,
  createDraftSchema,
} from "../validations/bill.validation";

const router = Router();

router.post(
  "/draft",
  authMiddleware,
  validateRequest(createDraftSchema),
  billingFlow.createDraftBill,
);

router.post(
  "/:billId/deductions/calc",
  authMiddleware,
  validateRequest(calculateDeductionSchema),
  billingFlow.calculateDeductions,
);

router.post(
  "/:billId/goni",
  authMiddleware,
  validateRequest(applyGoniSchema),
  billingFlow.applyGoniDeduction,
);

router.get("/:billId/preview", authMiddleware, billingFlow.previewDraft);

router.post(
  "/:billId/confirm",
  authMiddleware,
  upload.array("remarkFile", 5),
  billingFlow.confirmDraft,
);

// Get bills
router.get("/", authMiddleware, billController.getBills);

// Vendor last six months bill summary
router.get(
  "/graph/last-six-months",
  authMiddleware,
  billController.getVendorLastSixMonthsBillSummary,
);

// Get bill by ID
router.get("/:billId", authMiddleware, billController.getBillById);

export default router;
