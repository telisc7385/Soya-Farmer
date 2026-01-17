import { Router } from "express";
import * as locationController from "../controllers/location.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import * as locationValidation from "../validations/location.validation";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(locationValidation.createLocationSchema),
  locationController.createLocation,
);

router.get("/", authMiddleware, locationController.getLocations);

router.put(
  "/:id",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(locationValidation.updateLocationSchema),
  locationController.updateLocation,
);

export default router;
