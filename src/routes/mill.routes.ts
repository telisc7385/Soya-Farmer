import { Router } from "express";
import * as millController from "../controllers/mill.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { millSchema } from "../validations/mill.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(millSchema),
  millController.createMill,
);

router.put(
  "/:millId",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(millSchema),
  millController.updateMill,
);

router.get("/", authMiddleware, millController.getMills);

export default router;
