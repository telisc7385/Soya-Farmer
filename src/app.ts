import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import { errorHandler } from "./core/errorHandler";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("API is running ✅");
});

// routes
app.use("/api/auth", authRoutes);

// error handler
app.use(errorHandler);

export default app;
