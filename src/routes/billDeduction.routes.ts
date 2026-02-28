import { Router } from "express";
import { addDeductionsSchema } from "../validations/billDeduction.validation";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  addBillDeductions,
  updateBillDeduction,
  getBillDeductions,
  deleteBillDeduction,
} from "../controllers/billing/billDeduction.controller";

const router = Router();

router.post(
  "/:billId",
  validateRequest(addDeductionsSchema),
  addBillDeductions,
);
router.put(
  "/:billId/:deductionId",
  validateRequest(addDeductionsSchema),
  updateBillDeduction,
);

router.get("/:billId", getBillDeductions);

router.delete("/:billId/:deductionId", deleteBillDeduction);

export default router;
