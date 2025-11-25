import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import ShopSetting from "../models/ShopSetting.js";

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

// In-memory fallback storage if MongoDB is unavailable
let memoryStore = {
  settings: {
    _id: "global",
    shopName: "Bala Tarpaulins",
    address: "123 Business Street, City, State 12345",
    contact: "+1 (555) 123-4567",
    shopLogo: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const name = `logo-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "").trim();
  
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

async function getOrCreateSettings() {
  try {
    let settings = await ShopSetting.findById("global");
    if (!settings) {
      settings = await ShopSetting.create({ _id: "global" });
    }
    return settings;
  } catch (err) {
    console.warn("[settings] MongoDB unavailable, using in-memory store", err.message);
    return memoryStore.settings;
  }
}

async function saveSettings(settings) {
  try {
    // Extract only the fields we want to save
    const updateData = {
      shopName: settings.shopName,
      address: settings.address,
      contact: settings.contact,
    };
    
    // Include logo if it exists
    if (settings.shopLogo) {
      updateData.shopLogo = settings.shopLogo;
    }
    
    // Try to save to MongoDB
    const result = await ShopSetting.findByIdAndUpdate(
      "global",
      updateData,
      { new: true, upsert: true }
    );
    
    return result;
  } catch (err) {
    console.warn("[settings] MongoDB save failed, using in-memory store", err.message);
    // Fallback to memory store
    memoryStore.settings = { 
      ...memoryStore.settings, 
      shopName: settings.shopName,
      address: settings.address,
      contact: settings.contact,
      updatedAt: new Date() 
    };
    return memoryStore.settings;
  }
}

router.get("/", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.json(settings);
  } catch (err) {
    console.error("[settings] get failed", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Require authentication for update
router.put("/", verifyToken, async (req, res) => {
  try {
    const { shopName, address, contact } = req.body || {};
    
    // Validate input
    if (!shopName || !address || !contact) {
      return res.status(400).json({ 
        error: "Missing required fields: shopName, address, contact" 
      });
    }

    const settings = await getOrCreateSettings();
    
    if (typeof shopName === "string") settings.shopName = shopName.trim();
    if (typeof address === "string") settings.address = address.trim();
    if (typeof contact === "string") settings.contact = contact.trim();
    
    const updated = await saveSettings(settings);
    
    if (!updated) {
      return res.status(500).json({ error: "Failed to save settings - no result returned" });
    }

    // Return the updated settings with full URLs
    const response = {
      shopName: updated.shopName || "Bala Tarpaulins",
      address: updated.address || "",
      contact: updated.contact || "",
      shopLogo: updated.shopLogo ? updated.shopLogo : null,
      updatedAt: updated.updatedAt || new Date()
    };

    return res.json(response);
  } catch (err) {
    console.error("[settings] update failed:", err.message, err.stack);
    return res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

// Require authentication for logo upload
router.post("/logo", verifyToken, upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const settings = await getOrCreateSettings();
    const relativePath = `/uploads/${req.file.filename}`;
    const fullUrl = `${API_BASE_URL}${relativePath}`;
    
    settings.shopLogo = fullUrl;
    const updated = await saveSettings(settings);
    
    return res.json({ 
      shopLogo: fullUrl,
      settings: updated 
    });
  } catch (err) {
    console.error("[settings] logo upload failed", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
