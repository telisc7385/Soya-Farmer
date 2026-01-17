import { Router } from "express";
import {
  login,
  register
} from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { registerSchema, loginSchema } from "../validations/auth.validation";

const router = Router();

router.post("/vendor-register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);

export default router;
