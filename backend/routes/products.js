// server/routes/products.js
import express from "express";
import { randomUUID } from "crypto";
import Product from "../models/Product.js";

const normalizeString = (value) => String(value ?? "").trim();
const normalizeSku = (value) => normalizeString(value).toUpperCase();
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
const normalizeOptionalString = (value, fallback = "") =>
  value === undefined ? fallback : normalizeString(value);

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

function applyMongoRoutes(router, { onProductsChanged } = {}) {
  const notifyChange = async () => {
    if (!onProductsChanged) return;
    try {
      await onProductsChanged();
    } catch (err) {
      console.error("Failed to update dashboard stats after product mutation", err);
    }
  };
  async function upsertProduct(raw, { incrementQuantity = true } = {}) {
    const name = normalizeString(raw?.name);
    const skuSource = raw?.sku ?? raw?.productId;
    const normalizedSku = normalizeSku(skuSource);
    const normalizedProductId = normalizeSku(raw?.productId ?? skuSource);

    if (!name) throw new Error("name required");
    if (!normalizedSku) throw new Error("sku required");

    const quantity = parseInteger(raw?.quantity, 0);
    const price = parseNumber(raw?.price, 0);
    const reorderPoint = parseInteger(raw?.reorderPoint, 10) || 10;

    const lookup = {
      $or: [{ sku: normalizedSku }, { productId: normalizedProductId }],
    };

    const existing = await Product.findOne(lookup);

    if (existing) {
      if (incrementQuantity) {
        existing.quantity = parseInteger(existing.quantity, 0) + quantity;
      } else if (raw?.quantity !== undefined) {
        existing.quantity = quantity;
      }

      existing.name = name;
      existing.sku = normalizedSku;
      existing.productId = normalizedProductId || normalizedSku;
      existing.price = price;
      existing.reorderPoint = reorderPoint;
      if (raw?.size !== undefined) existing.size = normalizeString(raw.size);
      if (raw?.gsm !== undefined) existing.gsm = normalizeString(raw.gsm);
      if (raw?.image !== undefined) existing.image = raw.image;

      await existing.save();
      return { document: existing, created: false };
    }

    const newProduct = new Product({
      name,
      sku: normalizedSku,
      productId: normalizedProductId || normalizedSku,
      price,
      quantity,
      reorderPoint,
      size: normalizeOptionalString(raw?.size),
      gsm: normalizeOptionalString(raw?.gsm),
      image: raw?.image,
    });

    await newProduct.save();
    return { document: newProduct, created: true };
  }

  // GET /api/products/distinct?field=type&filterField=type&filterValue=HDPE
  router.get("/distinct", async (req, res) => {
    try {
      const { field, filterField, filterValue } = req.query;
      if (!field) return res.status(400).json({ error: "field required" });

      const query = {};
      if (filterField && filterValue) {
        query[filterField] = filterValue;
      }

      const values = await Product.distinct(field, query);
      const normalized = values
        .map((v) => normalizeString(v))
        .filter(Boolean);

      const allNumeric = normalized.every((v) => !Number.isNaN(Number(v)));
      normalized.sort((a, b) =>
        allNumeric ? Number(a) - Number(b) : a.localeCompare(b)
      );

      res.json({ values: normalized });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/products
  router.get("/", async (_req, res) => {
    try {
      const products = await Product.find();
      res.json(products);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/products
  router.post("/", async (req, res) => {
    try {
      const { document, created } = await upsertProduct(req.body, {
        incrementQuantity: true,
      });
      await notifyChange();
      res.status(created ? 201 : 200).json(document);
    } catch (err) {
      console.error(err);
      const message = err?.message || "Server error";
      const status = message.toLowerCase().includes("required") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // POST /api/products/bulk
  router.post("/bulk", async (req, res) => {
    const list = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: "items array required" });
    }

    const result = {
      inserted: 0,
      updated: 0,
      errors: [],
    };

    for (let i = 0; i < list.length; i += 1) {
      try {
        const { created } = await upsertProduct(list[i], {
          incrementQuantity: false,
        });
        if (created) {
          result.inserted += 1;
        } else {
          result.updated += 1;
        }
      } catch (err) {
        result.errors.push({ index: i, message: err?.message || "unknown error" });
      }
    }

    if (result.inserted > 0 || result.updated > 0) {
      await notifyChange();
    }

    res.status(200).json({ ...result, hasErrors: result.errors.length > 0 });
  });

  // PUT /api/products/:id
  router.put("/:id", async (req, res) => {
    try {
      const product = await loadProductByIdentifier(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      product.name = req.body?.name ? normalizeString(req.body.name) : product.name;

      if (req.body?.sku || req.body?.productId) {
        const normalizedSku = normalizeSku(req.body?.sku ?? req.body?.productId);
        if (!normalizedSku) return res.status(400).json({ error: "sku required" });
        product.sku = normalizedSku;
        product.productId = normalizeSku(req.body?.productId ?? normalizedSku) || normalizedSku;
      }

      if (req.body?.price !== undefined) {
        product.price = parseNumber(req.body.price, product.price);
      }

      if (req.body?.quantity !== undefined) {
        product.quantity = parseInteger(req.body.quantity, product.quantity);
      }

      if (req.body?.reorderPoint !== undefined) {
        product.reorderPoint = parseInteger(req.body.reorderPoint, product.reorderPoint);
      }

      if (req.body?.size !== undefined) product.size = normalizeString(req.body.size);
      if (req.body?.gsm !== undefined) product.gsm = normalizeString(req.body.gsm);
      if (req.body?.image !== undefined) product.image = req.body.image;

      await product.save();
      await notifyChange();
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // PATCH /api/products/:id/adjust-stock
  router.patch("/:id/adjust-stock", async (req, res) => {
    try {
      const delta = parseInteger(req.body?.amount, 0);
      const product = await loadProductByIdentifier(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      product.quantity = parseInteger(product.quantity, 0) + delta;
      await product.save();
      await notifyChange();
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // DELETE /api/products/:id
  router.delete("/:id", async (req, res) => {
    try {
      const product = await loadProductByIdentifier(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      await Product.findByIdAndDelete(product._id);
      await notifyChange();
      res.json({ message: "Product deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}

function applyMemoryRoutes(router) {
  const products = [];

  const findProductIndex = (id) =>
    products.findIndex(
      (p) => p.id === id || p.productId === id || p.sku === id
    );

  const upsertProduct = (raw, { incrementQuantity = true } = {}) => {
    const name = normalizeString(raw?.name);
    const normalizedSku = normalizeSku(raw?.sku ?? raw?.productId);
    const normalizedProductId = normalizeSku(raw?.productId ?? raw?.sku);

    if (!name) throw new Error("name required");
    if (!normalizedSku) throw new Error("sku required");

    const quantity = parseInteger(raw?.quantity, 0);
    const price = parseNumber(raw?.price, 0);
    const reorderPoint = parseInteger(raw?.reorderPoint, 10) || 10;

    const existingIndex = findProductIndex(normalizedSku);
    const now = new Date().toISOString();

    if (existingIndex !== -1) {
      const existing = products[existingIndex];
      const nextQuantity = incrementQuantity
        ? parseInteger(existing.quantity, 0) + quantity
        : raw?.quantity !== undefined
        ? quantity
        : existing.quantity;

      const updated = {
        ...existing,
        name,
        sku: normalizedSku,
        productId: normalizedProductId || normalizedSku,
        price,
        quantity: nextQuantity,
        reorderPoint,
        size: raw?.size !== undefined ? normalizeString(raw.size) : existing.size,
        gsm: raw?.gsm !== undefined ? normalizeString(raw.gsm) : existing.gsm,
        image: raw?.image !== undefined ? raw.image : existing.image,
        updatedAt: now,
      };

      products[existingIndex] = updated;
      return { document: updated, created: false };
    }

    const newProduct = {
      id: randomUUID(),
      name,
      sku: normalizedSku,
      productId: normalizedProductId || normalizedSku,
      price,
      quantity,
      reorderPoint,
      size: normalizeOptionalString(raw?.size),
      gsm: normalizeOptionalString(raw?.gsm),
      image: raw?.image,
      createdAt: now,
      updatedAt: now,
    };

    products.push(newProduct);
    return { document: newProduct, created: true };
  };

  // GET /api/products/distinct?field=type&filterField=type&filterValue=HDPE
  router.get("/distinct", (req, res) => {
    const { field, filterField, filterValue } = req.query;
    if (!field) return res.status(400).json({ error: "field required" });

    let list = products;
    if (filterField && filterValue) {
      list = list.filter((p) => String(p[filterField]) === String(filterValue));
    }

    const values = Array.from(new Set(list.map((p) => normalizeString(p[field])))).filter(Boolean);

    const allNumeric = values.every((v) => !Number.isNaN(Number(v)));
    values.sort((a, b) => (allNumeric ? Number(a) - Number(b) : a.localeCompare(b)));

    res.json({ values });
  });

  // GET /api/products
  router.get("/", (_req, res) => {
    res.json(products);
  });

  // POST /api/products
  router.post("/", (req, res) => {
    try {
      const { document, created } = upsertProduct(req.body, {
        incrementQuantity: true,
      });
      res.status(created ? 201 : 200).json(document);
    } catch (err) {
      const message = err?.message || "Server error";
      const status = message.toLowerCase().includes("required") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // POST /api/products/bulk
  router.post("/bulk", (req, res) => {
    const list = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: "items array required" });
    }

    const result = {
      inserted: 0,
      updated: 0,
      errors: [],
    };

    list.forEach((entry, index) => {
      try {
        const { created } = upsertProduct(entry, { incrementQuantity: false });
        if (created) {
          result.inserted += 1;
        } else {
          result.updated += 1;
        }
      } catch (err) {
        result.errors.push({ index, message: err?.message || "unknown error" });
      }
    });

    res
      .status(200)
      .json({ ...result, hasErrors: result.errors.length > 0 });
  });

  // PUT /api/products/:id
  router.put("/:id", (req, res) => {
    const idx = findProductIndex(req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    const now = new Date().toISOString();
    const current = products[idx];

    let normalizedSku;
    if (req.body?.sku || req.body?.productId) {
      normalizedSku = normalizeSku(req.body?.sku ?? req.body?.productId);
      if (!normalizedSku) return res.status(400).json({ error: "sku required" });
    }

    const updated = {
      ...current,
      name: req.body?.name ? normalizeString(req.body.name) : current.name,
      sku: normalizedSku || current.sku,
      productId: normalizeSku(req.body?.productId ?? normalizedSku) || current.productId,
      price: req.body?.price !== undefined ? parseNumber(req.body.price, current.price) : current.price,
      quantity: req.body?.quantity !== undefined ? parseInteger(req.body.quantity, current.quantity) : current.quantity,
      reorderPoint:
        req.body?.reorderPoint !== undefined
          ? parseInteger(req.body.reorderPoint, current.reorderPoint)
          : current.reorderPoint,
      size: req.body?.size !== undefined ? normalizeString(req.body.size) : current.size,
      gsm: req.body?.gsm !== undefined ? normalizeString(req.body.gsm) : current.gsm,
      image: req.body?.image !== undefined ? req.body.image : current.image,
      updatedAt: now,
    };

    products[idx] = updated;
    res.json(updated);
  });

  // PATCH /api/products/:id/adjust-stock
  router.patch("/:id/adjust-stock", (req, res) => {
    const idx = findProductIndex(req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    const delta = parseInteger(req.body?.amount, 0);
    const updated = {
      ...products[idx],
      quantity: parseInteger(products[idx].quantity, 0) + delta,
      updatedAt: new Date().toISOString(),
    };

    products[idx] = updated;
    res.json(updated);
  });

  // DELETE /api/products/:id
  router.delete("/:id", (req, res) => {
    const idx = findProductIndex(req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    products.splice(idx, 1);
    res.json({ message: "Product deleted successfully" });
  });

  return router;
}

export function createProductsRouter({ useMemoryStore = false, onProductsChanged } = {}) {
  const router = express.Router();
  return useMemoryStore
    ? applyMemoryRoutes(router)
    : applyMongoRoutes(router, { onProductsChanged });
}

export default createProductsRouter;
