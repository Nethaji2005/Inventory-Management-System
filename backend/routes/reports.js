import express from "express";
import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import DashboardStat from "../models/DashboardStat.js";

const router = express.Router();

const normalizeDateRange = (start, end) => {
  const range = {};

  if (start) {
    const parsed = new Date(start);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      range.$gte = parsed;
    }
  }

  if (end) {
    const parsed = new Date(end);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      range.$lte = parsed;
    }
  }

  return Object.keys(range).length > 0 ? range : null;
};

const adaptSale = (saleDoc) => {
  const createdAt = saleDoc.createdAt instanceof Date ? saleDoc.createdAt : new Date();
  const dateString = new Date(createdAt).toISOString().split("T")[0];

  return {
    id: saleDoc._id?.toString() ?? saleDoc.id ?? dateString,
    date: dateString,
    customerName: saleDoc.customerName ?? "",
    subtotal: Number(saleDoc.subtotal ?? 0),
    tax: Number(saleDoc.tax ?? 0),
    total: Number(saleDoc.total ?? 0),
    billId: saleDoc.billId ?? "",
    products: (saleDoc.items ?? saleDoc.products ?? []).map((item) => ({
      productId: item.productId ? item.productId.toString() : "",
      productName: item.productName ?? "",
      quantity: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),
      total: Number(item.total ?? (Number(item.price ?? 0) * Number(item.quantity ?? 0))),
    })),
  };
};

const adaptPurchase = (purchaseDoc) => {
  const createdAt = purchaseDoc.createdAt instanceof Date ? purchaseDoc.createdAt : new Date();
  const dateString = new Date(createdAt).toISOString().split("T")[0];

  return {
    id: purchaseDoc._id?.toString() ?? purchaseDoc.id ?? dateString,
    date: dateString,
    supplierName: purchaseDoc.supplierName ?? "Unknown Supplier",
    subtotal: Number(purchaseDoc.subtotal ?? 0),
    tax: Number(purchaseDoc.tax ?? 0),
    total: Number(purchaseDoc.total ?? 0),
    billId: purchaseDoc.billId ?? "",
    products: (purchaseDoc.items ?? purchaseDoc.products ?? []).map((item) => ({
      productId: item.productId ? item.productId.toString() : "",
      productName: item.productName ?? "",
      quantity: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),
      total: Number(item.total ?? (Number(item.price ?? 0) * Number(item.quantity ?? 0))),
    })),
  };
};

router.get("/", async (req, res) => {
  const { startDate, endDate } = req.query ?? {};

  const match = {};
  const dateFilter = normalizeDateRange(startDate, endDate);
  if (dateFilter) {
    match.createdAt = dateFilter;
  }

  try {
    const [salesDocs, purchaseDocs] = await Promise.all([
      Sale.find(match).sort({ createdAt: -1 }),
      Purchase.find(match).sort({ createdAt: -1 }),
    ]);

    const sales = salesDocs.map(adaptSale);
    const purchases = purchaseDocs.map(adaptPurchase);

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);

    const summary = {
      totalSales,
      totalPurchases,
      profit: totalSales - totalPurchases,
      salesCount: sales.length,
      purchaseCount: purchases.length,
    };

    let dashboard = await DashboardStat.findById("global");
    if (!dashboard) {
      dashboard = await DashboardStat.create({ _id: "global" });
    }

    res.json({ summary, sales, purchases, dashboard });
  } catch (err) {
    console.error("Failed to build reports payload", err);
    res.status(500).json({ error: err?.message ?? "Failed to load reports" });
  }
});

// GET /api/reports/monthly-sales - Get sales aggregated by month for the last 12 months
router.get("/monthly-sales", async (req, res) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    const salesByMonth = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          totalSales: { $sum: "$total" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    // Format the response with month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedData = salesByMonth.map(item => ({
      month: monthNames[item._id.month - 1],
      year: item._id.year,
      value: item.totalSales,
      count: item.count
    }));

    res.json({ data: formattedData });
  } catch (err) {
    console.error("Failed to get monthly sales", err);
    res.status(500).json({ error: err?.message ?? "Failed to load monthly sales" });
  }
});

export default router;
