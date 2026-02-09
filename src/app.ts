import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import farmerRoutes from "./routes/farmer.routes";
import locationRoutes from "./routes/location.routes";
import productRoutes from "./routes/product.routes";
import stocksRoutes from "./routes/stock.routes";
import millRoutes from "./routes/mill.routes";
import billingRoutes from "./routes/bill.routes";
import adminRoutes from "./routes/admin.route";
import { errorHandler } from "./core/errorHandler";
import path from "path";
import { routeNotFoundError } from "./core/routeNotFoundError";

dotenv.config();

const app = express();

app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

// Middlewares
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("API is running ✅");
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/product", productRoutes);
app.use("/api/stock", stocksRoutes);
app.use("/api/mill", millRoutes);
app.use("/api/bill", billingRoutes);
app.use("/api/admin", adminRoutes);

// error handler
app.use(routeNotFoundError);
app.use(errorHandler);

export default app;
