import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contact.js";
import settingsRoutes from "./routes/settings.js";
import subscriptionRoutes from "./routes/subscription.js";
import notificationsRoutes from "./routes/notifications.js";
import adminRoutes from "./routes/admin.js";
import chatRoutes from "./routes/chat.js";
import qaRoutes from "./routes/qa.js";
import scanRoutes from "./routes/scan.js";
import reportRoutes from "./routes/report.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - ALLOW ALL ORIGINS (Development Mode)
app.use(
  cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
  })
);

// Parse JSON bodies
app.use(express.json());

// Serve static files for uploads
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../frontend/public/uploads')));

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "HackSentinel Auth API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/scan", scanRoutes);
app.use("/api/report", reportRoutes);

mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || "hacksentinel",
  })
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Auth server running on port ${PORT}`);
    });
    server.timeout = 600000; // 10 minutes for active scans
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });


