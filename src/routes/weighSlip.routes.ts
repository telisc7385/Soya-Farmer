import { Router } from "express";
import {
  addWeighSlip,
  getWeighSlips,
} from "../controllers/weighSlip.controller";
import { createWeighSlipSchema } from "../validations/weighSlip.validation";
import { validateRequest } from "../middleware/validateRequest.middleware";

const router = Router();

router.post("/:billId", validateRequest(createWeighSlipSchema), addWeighSlip);

router.get("/:billId", getWeighSlips);

export default router;
