import { Router } from "express";
import {
  handleDeployWebhook,
  handleDeployStatus,
} from "./deploy.controller";

const router = Router();

router.post("/deploy", handleDeployWebhook);
router.get("/status", handleDeployStatus);

export default router;
