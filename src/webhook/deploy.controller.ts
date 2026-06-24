import { Request, Response, NextFunction } from "express";
import { verifyGitHubSignature } from "./github-signature";
import { getDeployStatus, runDeployment } from "./deploy.service";
import { log, logError } from "../utils/logger";
import { envConfig } from "../config/env";

export async function handleDeployWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    const isValid = verifyGitHubSignature(
      JSON.stringify(req.body),
      signature,
      envConfig.githubWebhookSecret
    );

    if (!isValid) {
      logError("[Webhook] Invalid signature received");
      res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
      return;
    }

    const event = req.headers["x-github-event"] as string;
    log(`[Webhook] Received event: ${event}`);

    if (event === "ping") {
      res.status(200).json({
        success: true,
        message: "pong",
      });
      return;
    }

    if (event !== "push") {
      res.status(200).json({
        success: true,
        message: `Ignored event: ${event}`,
      });
      return;
    }

    const status = getDeployStatus();
    if (status.running) {
      res.status(409).json({
        success: false,
        message: "A deployment is already in progress",
      });
      return;
    }

    res.status(202).json({
      success: true,
      message: "Deployment started",
    });

    runDeployment().catch((err) => {
      logError(`[Webhook] Background deployment failed: ${err}`);
    });
  } catch (err) {
    next(err);
  }
}

export async function handleDeployStatus(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const status = getDeployStatus();
  res.json({
    success: true,
    data: {
      running: status.running,
      lastDeployment: status.lastDeployment,
      status: status.status,
    },
  });
}
