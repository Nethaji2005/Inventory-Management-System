import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const normalizeString = (value) => String(value ?? "").trim();

const TOKEN_TTL = process.env.JWT_TTL || "12h";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const buildTokenPayload = (user) => ({
  sub: String(user._id),
  email: user.email,
  role: user.role,
  name: user.name,
});

const signToken = (user) =>
  jwt.sign(buildTokenPayload(user), JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });

router.post("/register", async (req, res) => {
  try {
    const name = normalizeString(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const role = req.body?.role;

    if (!name) return res.status(400).json({ error: "name required" });
    if (!email) return res.status(400).json({ error: "email required" });
    if (!password) return res.status(400).json({ error: "password required" });

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const user = await User.createUser({ name, email, password, role });
    const token = signToken(user);

    return res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    console.error("[auth] register failed", err);
    const message = err?.message || "Server error";
    const status = message.toLowerCase().includes("password") ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await User.findOne({ email, isActive: true }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordValid = await user.comparePassword(password);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user,
    });
  } catch (err) {
    console.error("[auth] login failed", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user, tokenExpiresAt: payload.exp ? payload.exp * 1000 : undefined });
  } catch (err) {
    console.error("[auth] me failed", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
