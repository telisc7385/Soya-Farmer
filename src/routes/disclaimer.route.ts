import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  getDisclaimer,
  updateDisclaimer,
} from "../controllers/admin/disclaimer.controller";
import { updateDisclaimerSchema } from "../validations/disclaimer.validation";

const router = Router();

router.get("/", getDisclaimer);

router.put(
  "/",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateDisclaimerSchema),
  updateDisclaimer,
);

export default router;
