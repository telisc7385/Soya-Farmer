import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Router } from "express";
import * as bankDetailsController from "../controllers/bankDetails.controller";

const router = Router();

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN"),
  bankDetailsController.createBankDetails,
);

router.get("/", authMiddleware, bankDetailsController.getAllBankDetails);

router.patch(
  "/:bankId",
  authMiddleware,
  authorize("ADMIN"),
  bankDetailsController.updateBankDetails,
);

router.delete(
  "/:bankId",
  authMiddleware,
  authorize("ADMIN"),
  bankDetailsController.deleteBankDetails,
);

export default router;
