import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import createProductsRouter from "./routes/products.js";
import purchasesRouter from "./routes/purchases.js";
import salesRouter from "./routes/sales.js";
import dashboardRouter from "./routes/dashboard.js";
import reportsRouter from "./routes/reports.js";
import authRouter from "./routes/auth.js";
import settingsRouter from "./routes/settings.js";
import User from "./models/User.js";
import { recalculateDashboardStats } from "./utils/dashboardMetrics.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
async function startServer() {
  let useMemoryStore = true;

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 });
    console.log("MongoDB connected");
    useMemoryStore = false;
    await ensureDefaultAdminUser();
  } catch (err) {
    console.warn("MongoDB connection failed. Using in-memory store instead.", err?.message || err);
  }

  const productsRouter = createProductsRouter({
    useMemoryStore,
    onProductsChanged: useMemoryStore ? undefined : recalculateDashboardStats,
  });
  app.use("/api/products", productsRouter);
  app.use("/api/purchases", purchasesRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/settings", settingsRouter);

  // Serve uploaded files (shop logos etc.)
  const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsDir));

  if (!useMemoryStore) {
    recalculateDashboardStats().catch((err) => {
      console.error("Failed to generate initial dashboard stats", err);
    });
  }

  const server = app.listen(PORT, () => {
    const mode = useMemoryStore ? "in-memory" : "MongoDB";
    console.log(`Server running on http://localhost:${PORT} (${mode} mode)`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

async function ensureDefaultAdminUser() {
  const email = (process.env.DEFAULT_ADMIN_EMAIL || "admin@shop.local").trim().toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "password";
  const name = process.env.DEFAULT_ADMIN_NAME || "Admin User";

  if (!email || !password) return;

  const existing = await User.findOne({ email });
  if (existing) {
    let shouldSave = false;
    if (!existing.isActive) {
      existing.isActive = true;
      shouldSave = true;
    }

    if (!existing.passwordHash && existing.password) {
      existing.passwordHash = existing.password;
      shouldSave = true;
    }

    if (!existing.passwordHash && !existing.password) {
      existing.passwordHash = await User.hashPassword(password);
      shouldSave = true;
    }

    if (shouldSave) {
      await existing.save();
    }
    return;
  }

  await User.createUser({ name, email, password, role: "admin" });
  console.log(`Created default admin user (${email})`);
}
