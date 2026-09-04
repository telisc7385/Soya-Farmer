import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import * as locationControllers from "../controllers/location.controller";
import { addVillageSchema } from "../validations/location.validation";

const router = Router();

router.get(
  "/districts",
  authMiddleware,
  locationControllers.getDistrictsController,
);

router.get(
  "/districts/:districtCode/talukas",
  authMiddleware,
  locationControllers.getTalukasController,
);

router.get(
  "/talukas/:talukaCode/villages",
  authMiddleware,
  locationControllers.getVillagesController,
);

router.post(
  "/talukas/:talukaCode/villages",
  authMiddleware,
  validateRequest(addVillageSchema),
  locationControllers.addVillageController,
);

export default router;
