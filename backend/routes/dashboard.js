import express from "express";
import { getDashboardStats, recalculateDashboardStats } from "../utils/dashboardMetrics.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/recalculate", async (_req, res) => {
  try {
    const stats = await recalculateDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
