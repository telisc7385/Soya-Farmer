import { Router } from "express";
import {
  adminResetPassword,
  getVendorById,
  getVendorList,
  listAdmins,
  login,
  register,
  registerAdmin,
  updateAdmin,
  updateAdminStatus,
  updateVendor,
  updateVendorStatus,
} from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  adminResetPasswordSchema,
  registerSchema,
  loginSchema,
  registerAdminSchema,
  updateAdminSchema,
  updateVendorSchema,
} from "../validations/auth.validation";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  authorize,
  requireMasterAdmin,
} from "../middleware/role.middleware";

const router = Router();

router.post("/vendor-register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);

router.put(
  "/vendor/:id",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateVendorSchema),
  updateVendor,
);
router.patch(
  "/vendor/:id/status",
  authMiddleware,
  authorize("ADMIN"),
  updateVendorStatus,
);
router.get(
  "/vendor/list",
  authMiddleware,
  authorize("ADMIN", "VENDOR"),
  getVendorList,
);
router.get("/vendor/:id", authMiddleware, authorize("ADMIN"), getVendorById);
router.post(
  "/admin/reset-password",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(adminResetPasswordSchema),
  adminResetPassword,
);

// =====================
// MASTER ADMIN - ADMIN MANAGEMENT
// =====================
router.post(
  "/admin/register",
  authMiddleware,
  requireMasterAdmin,
  validateRequest(registerAdminSchema),
  registerAdmin,
);
router.get(
  "/admin/list",
  authMiddleware,
  requireMasterAdmin,
  listAdmins,
);
router.put(
  "/admin/:id",
  authMiddleware,
  requireMasterAdmin,
  validateRequest(updateAdminSchema),
  updateAdmin,
);
router.patch(
  "/admin/:id/status",
  authMiddleware,
  requireMasterAdmin,
  updateAdminStatus,
);

export default router;
