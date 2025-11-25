import mongoose from "mongoose";

const dashboardStatSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },
    totalSales: { type: Number, default: 0 },
    inventoryValue: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    lowStock: { type: Number, default: 0 },
    outOfStock: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "dashboard_stats",
  }
);

const DashboardStat = mongoose.model("DashboardStat", dashboardStatSchema);

export default DashboardStat;
