import { Router } from "express";
import {
  addBillDeductions,
  deleteBillDeduction,
  getBillDeductions,
  updateBillDeduction,
} from "../controllers/billDeduction.controller";
import { addDeductionsSchema } from "../validations/billDeduction.validation";
import { validateRequest } from "../middleware/validateRequest.middleware";

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
