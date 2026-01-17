import { Router } from "express";
import {
  getVendorList,
  login,
  register,
  updateVendor,
  updateVendorStatus,
} from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { registerSchema, loginSchema } from "../validations/auth.validation";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.post("/vendor-register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);

router.put("/vendor/:id", authMiddleware, authorize("ADMIN"), updateVendor);
router.patch(
  "/vendor/:id/status",
  authMiddleware,
  authorize("ADMIN"),
  updateVendorStatus,
);
router.get("/vendor/list", authMiddleware, authorize("ADMIN"), getVendorList);

export default router;
