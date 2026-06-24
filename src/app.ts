import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import farmerRoutes from "./routes/farmer.routes";
import billingRoutes from "./routes/bill.routes";
import adminRoutes from "./routes/admin.route";
import bankDetailsRoutes from "./routes/bankDetails.route";
import stockRoutes from "./routes/stock.routes";
import disclaimerRoutes from "./routes/disclaimer.route";
import webhookRoutes from "./webhook/deploy.routes";
import { errorHandler } from "./core/errorHandler";
import path from "path";
import { routeNotFoundError } from "./core/routeNotFoundError";

dotenv.config();

const app = express();

app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

// Middlewares
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);

// Health check
app.get("/", (req, res) => {
  res.send("API is running ✅");
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/bill", billingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/bank-details", bankDetailsRoutes);
app.use("/api/disclaimer", disclaimerRoutes);
app.use("/api/webhook", webhookRoutes);

// error handler
app.use(routeNotFoundError);
app.use(errorHandler);

export default app;
