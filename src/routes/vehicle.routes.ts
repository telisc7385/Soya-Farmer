// src/routes/vehicle.routes.ts
import { Router } from "express";
import * as vehicleController from "../controllers/vehicle.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "../validations/vehicle.validation";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// ADMIN ONLY
router.post(
  "/",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createVehicleSchema),
  vehicleController.createVehicle,
);

router.get("/", authMiddleware, vehicleController.getVehicles);

router.get("/:id", authMiddleware, vehicleController.getVehicleById);

router.put(
  "/:id",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateVehicleSchema),
  vehicleController.updateVehicle,
);

router.delete(
  "/:id",
  authMiddleware,
  authorize("ADMIN"),
  vehicleController.deleteVehicle,
);

export default router;
