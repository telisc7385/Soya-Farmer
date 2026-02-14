// src/routes/farmer.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { payFarmer, rejectBill } from "../controllers/adminPayment.controller";
import {
  createDeductionMaster,
  listDeductionMasters,
  toggleDeductionMaster,
  updateDeductionMaster,
} from "../controllers/admin/deductionMaster.controller";
import {
  createGoniType,
  listGoniTypes,
  updateGoniType,
} from "../controllers/admin/goniType.controller";
import * as transferController from "../controllers/stockTransfer.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  payFarmerSchema,
  rejectFarmerSchema,
} from "../validations/payment.validation";
import {
  createDeductionMasterSchema,
  updateDeductionMasterSchema,
  toggleDeductionMasterSchema,
  createGoniTypeSchema,
  updateGoniTypeSchema,
} from "../validations/admin.validation";
import { updateTransferSchema } from "../validations/stock.validation";
const router = Router();

router.post(
  "/:billId/pay",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(payFarmerSchema),
  payFarmer,
);

router.post(
  "/:billId/reject",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(rejectFarmerSchema),
  rejectBill,
);
router.post(
  "/deductions",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createDeductionMasterSchema),
  createDeductionMaster,
);

router.put(
  "/deductions/:masterId",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateDeductionMasterSchema),
  updateDeductionMaster,
);

router.patch(
  "/deductions/:masterId/toggle",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(toggleDeductionMasterSchema),
  toggleDeductionMaster,
);

router.get(
  "/deductions",
  authMiddleware,
  authorize("ADMIN"),
  listDeductionMasters,
);

router.post(
  "/goni-types",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createGoniTypeSchema),
  createGoniType,
);

router.put(
  "/goni-types/:goniTypeId",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateGoniTypeSchema),
  updateGoniType,
);

router.get("/goni-types", authMiddleware, authorize("ADMIN"), listGoniTypes);

// =====================
// STOCK TRANSFER ROUTES (ADMIN)
// =====================

// Get all transfers
router.get(
  "/transfers",
  authMiddleware,
  authorize("ADMIN"),
  transferController.getAdminTransfers,
);

// update transfer
router.put(
  "/transfers/:transferId/update",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateTransferSchema),
  transferController.completeTransfer,
);

// Complete transfer
router.put(
  "/transfers/:transferId/complete",
  authMiddleware,
  authorize("ADMIN"),
  transferController.completeTransfer,
);

// Update transfer (only weight and unit)
router.put(
  "/transfers/:transferId/update",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateTransferSchema),
  transferController.updateTransfer,
);

// Get admin stock summary
router.get(
  "/stock/summary",
  authMiddleware,
  authorize("ADMIN"),
  transferController.getAdminStockSummary,
);

export default router;
