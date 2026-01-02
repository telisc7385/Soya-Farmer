import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("API is running ✅");
});

export default app;
