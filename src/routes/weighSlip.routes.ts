import { Router } from "express";
import {
  addWeighSlip,
  deleteWeighSlip,
  getWeighSlips,
} from "../controllers/weighSlip.controller";
import { createWeighSlipSchema } from "../validations/weighSlip.validation";
import { validateRequest } from "../middleware/validateRequest.middleware";

const router = Router();

router.post("/:billId", validateRequest(createWeighSlipSchema), addWeighSlip);

router.get("/:billId", getWeighSlips);

router.delete("/:billId/:slipId", deleteWeighSlip);

export default router;
