import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { getVendorDeductions } from "../controllers/admin/deductionMaster.controller";

const router = Router();

router.get(
  "/deductions",
  authMiddleware,
  authorize("VENDOR", "ADMIN"),
  getVendorDeductions,
);

export default router;
