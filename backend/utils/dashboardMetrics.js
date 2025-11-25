import DashboardStat from "../models/DashboardStat.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import Sale from "../models/Sale.js";

const DASHBOARD_ID = "global";

function toNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
}

async function buildInventorySnapshot(session = null) {
  const query = session ? Product.find().session(session) : Product.find();
  const products = await query;

  const inventoryValue = products.reduce(
    (sum, product) => sum + toNumber(product.price) * toNumber(product.quantity),
    0
  );

  const { lowStockCount, outOfStockCount } = products.reduce(
    (acc, product) => {
      const quantity = toNumber(product.quantity);
      const reorderPoint = toNumber(product.reorderPoint);

      if (quantity <= 0) {
        acc.outOfStockCount += 1;
      } else if (quantity <= reorderPoint) {
        acc.lowStockCount += 1;
      }

      return acc;
    },
    { lowStockCount: 0, outOfStockCount: 0 }
  );

  return {
    inventoryValue,
    lowStock: lowStockCount,
    outOfStock: outOfStockCount,
  };
}

async function buildSalesSnapshot(session = null) {
  const saleAggregateQuery = Sale.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (session) {
    saleAggregateQuery.session(session);
  }

  const [salesAggregate] = await saleAggregateQuery;

  return {
    totalSales: salesAggregate?.total ?? 0,
    orders: salesAggregate?.count ?? 0,
  };
}

async function buildPurchasesSnapshot(session = null) {
  const purchaseAggregateQuery = Purchase.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (session) {
    purchaseAggregateQuery.session(session);
  }

  const [purchaseAggregate] = await purchaseAggregateQuery;

  return {
    totalPurchases: purchaseAggregate?.total ?? 0,
    purchaseCount: purchaseAggregate?.count ?? 0,
  };
}

export async function recalculateDashboardStats(session = null) {
  const [inventorySnapshot, salesSnapshot, purchaseSnapshot] = await Promise.all([
    buildInventorySnapshot(session),
    buildSalesSnapshot(session),
    buildPurchasesSnapshot(session),
  ]);

  const orders = Math.max(salesSnapshot.orders, purchaseSnapshot.purchaseCount);

  const stats = await DashboardStat.findByIdAndUpdate(
    DASHBOARD_ID,
    {
      totalSales: toNumber(salesSnapshot.totalSales),
      inventoryValue: toNumber(inventorySnapshot.inventoryValue),
      orders,
      lowStock: inventorySnapshot.lowStock,
      outOfStock: inventorySnapshot.outOfStock,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session: session ?? undefined,
    }
  );

  return stats;
}

export async function getDashboardStats() {
  const stats = await DashboardStat.findById(DASHBOARD_ID);
  if (!stats || typeof stats.outOfStock !== "number") {
    return recalculateDashboardStats();
  }
  return stats;
}

export async function incrementDashboardCounters(
  { totalSalesDelta = 0, ordersDelta = 0 } = {},
  session = null
) {
  const inc = {};
  const normalizedSales = toNumber(totalSalesDelta);
  if (Number.isFinite(normalizedSales) && normalizedSales !== 0) {
    inc.totalSales = normalizedSales;
  }

  const rawOrdersDelta = toNumber(ordersDelta);
  const normalizedOrders = Number.isFinite(rawOrdersDelta) ? Math.trunc(rawOrdersDelta) : 0;

  if (Number.isFinite(normalizedOrders) && normalizedOrders !== 0) {
    inc.orders = normalizedOrders;
  }

  if (Object.keys(inc).length === 0) {
    const existingQuery = DashboardStat.findById(DASHBOARD_ID);
    if (session) {
      existingQuery.session(session);
    }
    return existingQuery;
  }

  return DashboardStat.findByIdAndUpdate(
    DASHBOARD_ID,
    { $inc: inc },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session: session ?? undefined,
    }
  );
}
