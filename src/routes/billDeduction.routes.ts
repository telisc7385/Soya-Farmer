import { Router } from "express";
import {
  addBillDeductions,
  getBillDeductions,
} from "../controllers/billDeduction.controller";
import { addDeductionsSchema } from "../validations/billDeduction.validation";
import { validateRequest } from "../middleware/validateRequest.middleware";

const router = Router();

router.post(
  "/:billId",
  validateRequest(addDeductionsSchema),
  addBillDeductions,
);

router.get("/:billId", getBillDeductions);

export default router;
