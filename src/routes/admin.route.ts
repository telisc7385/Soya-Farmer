// src/routes/farmer.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { payFarmer, rejectBill } from "../controllers/adminPayment.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  payFarmerSchema,
  rejectFarmerSchema,
} from "../validations/payment.validation";

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

export default router;
