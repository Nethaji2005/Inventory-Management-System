import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import { incrementDashboardCounters, recalculateDashboardStats } from "../utils/dashboardMetrics.js";

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

const loadProductByIdentifier = async (identifier) => {
  if (!identifier) return null;

  const trimmed = normalizeString(identifier);
  const normalizedCode = trimmed.toUpperCase();

  // Try SKU/productId first (most common case)
  const byCodeResult = await Product.findOne({
    $or: [{ productId: normalizedCode }, { sku: normalizedCode }],
  });
  
  if (byCodeResult) return byCodeResult;

  // Only try MongoDB ObjectId if it's a valid 24-char hex string
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    const byIdResult = await Product.findById(trimmed);
    if (byIdResult) return byIdResult;
  }

  return null;
};

const persistSale = async (body) => {
  const { billId, customerName, subtotal, tax, total, items, invoiceDate, date } = body;

  const updatedProducts = [];
  const normalizedItems = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const productId = item?.productId;
    const quantityToDeduct = parseInteger(item?.quantity, 0);
    const price = parseNumber(item?.price, 0);
    const pricePerQuantity = parseNumber(item?.pricePerQuantity, 0);

    if (!productId) {
      throw new Error(`items[${i}].productId required`);
    }

    if (quantityToDeduct <= 0) {
      throw new Error(`items[${i}].quantity must be greater than 0`);
    }

    const product = await loadProductByIdentifier(productId);
    if (!product) {
      throw new Error(`Product not found for id ${productId}`);
    }

    const currentQuantity = parseInteger(product.quantity, 0);
    if (currentQuantity < quantityToDeduct) {
      throw new Error(`Insufficient stock for product ${product.name}`);
    }

    const effectivePrice = price > 0 ? price : parseNumber(product.price, 0);

    product.quantity = currentQuantity - quantityToDeduct;
    product.price = effectivePrice > 0 ? effectivePrice : parseNumber(product.price, 0);

    await product.save();

    updatedProducts.push(product);
    normalizedItems.push({
      productId: String(product._id),
      productName: product.name,
      quantity: quantityToDeduct,
      price: effectivePrice,
      pricePerQuantity: pricePerQuantity > 0 ? pricePerQuantity : (effectivePrice * quantityToDeduct),
      total: (pricePerQuantity > 0 ? pricePerQuantity : effectivePrice) * quantityToDeduct,
      size: normalizeString(product.size),
      gsm: normalizeString(product.gsm),
    });
  }

  const sale = new Sale({
    billId: normalizeString(billId),
    customerName: normalizeString(customerName),
    subtotal: parseNumber(subtotal, 0),
    tax: parseNumber(tax, 0),
    total: parseNumber(total, 0),
    items: normalizedItems,
  });

  const providedDate = date ?? invoiceDate;
  if (providedDate) {
    const parsedDate = new Date(providedDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      sale.set({ createdAt: parsedDate, updatedAt: parsedDate });
    }
  }

  await sale.save();

  return { sale, updatedProducts };
};

router.get("/products", async (_req, res) => {
  try {
    const products = await Product.find({ quantity: { $gt: 0 } });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  const { billId, customerName, subtotal, tax, total, items, invoiceDate, date } = req.body || {};

  if (!billId) {
    return res.status(400).json({ error: "billId required" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array required" });
  }

  try {
    const result = await persistSale({ billId, customerName, subtotal, tax, total, items, invoiceDate, date });

    let dashboardStats = null;
    if (process.env.NODE_ENV !== "test") {
      try {
        await incrementDashboardCounters({
          totalSalesDelta: result.sale?.total ?? total,
          ordersDelta: 1,
        });
        dashboardStats = await recalculateDashboardStats();
      } catch (metricsErr) {
        console.error("Failed to recalculate dashboard stats after sale", metricsErr);
      }
    }

    const responseBody = {
      sale: result.sale,
      updatedProducts: result.updatedProducts,
    };

    if (dashboardStats) {
      responseBody.dashboard = dashboardStats;
    }

    return res.status(201).json(responseBody);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

export default router;
