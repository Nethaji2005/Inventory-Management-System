import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import { recalculateDashboardStats } from "../utils/dashboardMetrics.js";

const router = express.Router();

const normalizeString = (value) => String(value ?? "").trim();
const parseInteger = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const canUseTransactions = () => {
  try {
    const connection = mongoose.connection;
    const client = typeof connection.getClient === "function" ? connection.getClient() : connection?.client;

    // Modern driver exposes topology description with the cluster type
    const topologyType = client?.topology?.description?.type;
    console.log("[purchases] Mongo topology type:", topologyType);
    if (topologyType && topologyType !== "Single") {
      return true;
    }

    // Older driver surfaces replica set info on options
    const replicaSetName = client?.options?.replicaSet ?? client?.s?.options?.replicaSet;
    console.log("[purchases] Mongo replicaSet option:", replicaSetName);
    if (replicaSetName) {
      return true;
    }

    // Connection strings with an explicit replica set also indicate support
    const connectionString = client?.s?.url ?? process.env.MONGO_URI ?? process.env.MONGODB_URI;
    console.log("[purchases] Mongo connection string:", connectionString);
    if (typeof connectionString === "string" && connectionString.includes("replicaSet=")) {
      return true;
    }
  } catch (err) {
    console.warn("Unable to determine MongoDB topology for transactions", err);
  }

  return false;
};

const loadProductByIdentifier = async (identifier, session = null) => {
  if (!identifier) return null;

  const trimmed = normalizeString(identifier);
  const normalizedCode = trimmed.toUpperCase();

  // Try SKU/productId first (most common case)
  const byCodeQuery = Product.findOne({
    $or: [{ productId: normalizedCode }, { sku: normalizedCode }],
  });
  if (session) byCodeQuery.session(session);
  
  const byCodeResult = await byCodeQuery;
  if (byCodeResult) return byCodeResult;

  // Only try MongoDB ObjectId if it's a valid 24-char hex string
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    const byIdQuery = Product.findById(trimmed);
    if (session) byIdQuery.session(session);
    const byIdResult = await byIdQuery;
    if (byIdResult) return byIdResult;
  }

  return null;
};

const persistPurchase = async (body, session = null) => {
  const { billId, supplierName, subtotal, tax, total, items } = body;

  const updatedProducts = [];
  const normalizedItems = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const productId = item?.productId;
    const quantityToAdd = parseInteger(item?.quantity, 0);
    const price = parseNumber(item?.price, 0);

    if (!productId) {
      throw new Error(`items[${i}].productId required`);
    }

    if (quantityToAdd <= 0) {
      throw new Error(`items[${i}].quantity must be greater than 0`);
    }

    const product = await loadProductByIdentifier(productId, session);
    if (!product) {
      throw new Error(`Product not found for id ${productId}`);
    }

    const baseQuantity = parseInteger(product.quantity, 0);
    const effectivePrice = price > 0 ? price : parseNumber(product.price, 0);

    product.quantity = baseQuantity + quantityToAdd;
    product.price = effectivePrice;

    if (session) {
      await product.save({ session });
    } else {
      await product.save();
    }

    updatedProducts.push(product);
    normalizedItems.push({
      productId: String(product._id),
      productName: product.name,
      quantity: quantityToAdd,
      price: effectivePrice,
      total: effectivePrice * quantityToAdd,
      size: normalizeString(product.size),
      gsm: normalizeString(product.gsm),
    });
  }

  const purchase = new Purchase({
    billId: normalizeString(billId),
    supplierName: normalizeString(supplierName) || "Unknown Supplier",
    subtotal: parseNumber(subtotal, 0),
    tax: parseNumber(tax, 0),
    total: parseNumber(total, 0),
    items: normalizedItems,
  });

  if (session) {
    await purchase.save({ session });
  } else {
    await purchase.save();
  }

  return { purchase, updatedProducts };
};

router.get("/products", async (_req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  const { billId, supplierName, subtotal, tax, total, items } = req.body || {};

  console.log("[purchases] POST /api/purchases invoked", {
    hasItems: Array.isArray(items) && items.length > 0,
    billId,
  });

  if (!billId) {
    return res.status(400).json({ error: "billId required" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array required" });
  }

  let session = null;
  let shouldUseTransactions = false;

  try {
    const transactionsToggle = (process.env.MONGO_TRANSACTIONS ?? "false").toLowerCase();
    const transactionsRequested = transactionsToggle === "true" || transactionsToggle === "1";
    shouldUseTransactions = transactionsRequested && canUseTransactions();

    session = shouldUseTransactions ? await mongoose.startSession() : null;
    if (session) {
      session.startTransaction();
    }

    const result = await persistPurchase({ billId, supplierName, subtotal, tax, total, items }, session);

    if (session) {
      await session.commitTransaction();
    }

    let dashboardStats = null;
    if (process.env.NODE_ENV !== "test") {
      try {
        dashboardStats = await recalculateDashboardStats();
      } catch (metricsErr) {
        console.error("Failed to recalculate dashboard stats after purchase", metricsErr);
      }
    }

    const responsePayload = dashboardStats ? { ...result, dashboard: dashboardStats } : result;

    return res.status(201).json(responsePayload);
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error("Failed to abort MongoDB transaction", abortErr);
      }
    }

    if (shouldUseTransactions && err?.message?.includes("Transaction numbers are only allowed")) {
      console.warn("MongoDB transactions unsupported; retrying purchase without transaction support");
      try {
        const fallbackResult = await persistPurchase({ billId, supplierName, subtotal, tax, total, items }, null);

        let dashboardStats = null;
        if (process.env.NODE_ENV !== "test") {
          dashboardStats = await recalculateDashboardStats().catch((metricsErr) => {
            console.error("Failed to recalculate dashboard stats after purchase (fallback)", metricsErr);
            return null;
          });
        }

        const responsePayload = dashboardStats
          ? { ...fallbackResult, dashboard: dashboardStats }
          : fallbackResult;

        return res.status(201).json(responsePayload);
      } catch (fallbackErr) {
        console.error(fallbackErr);
        return res.status(500).json({ error: fallbackErr?.message || "Server error" });
      }
    }

    console.error(err);
    return res.status(500).json({ error: err?.message || "Server error" });
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (endErr) {
        console.error("Failed to end MongoDB session", endErr);
      }
    }
  }
});

export default router;
