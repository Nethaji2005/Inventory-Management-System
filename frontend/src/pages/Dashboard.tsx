import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShop } from '@/contexts/ShopContext';
import type { Sale } from '@/contexts/ShopContext';
import { AlertTriangle, DollarSign, Package, ShoppingCart } from 'lucide-react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface MonthlySalesData {
  month: string;
  year: number;
  value: number;
  count: number;
}

const buildMonthlySeries = (sales: Sale[]) => {
  const buckets = new Map<string, { month: string; year: number; value: number; count: number; monthIndex: number }>();

  sales.forEach((sale) => {
    const date = sale?.date ? new Date(sale.date) : null;
    if (!date || Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const existing = buckets.get(key);

    const normalizedTotal = Number(sale.total ?? 0) || 0;
    if (existing) {
      existing.value += normalizedTotal;
      existing.count += 1;
      return;
    }

    buckets.set(key, {
      month: date.toLocaleString('default', { month: 'short' }),
      year: date.getFullYear(),
      value: normalizedTotal,
      count: 1,
      monthIndex: date.getMonth(),
    });
  });

  return Array.from(buckets.values())
    .sort((a, b) => (a.year === b.year ? a.monthIndex - b.monthIndex : a.year - b.year))
    .map(({ monthIndex: _unused, ...rest }) => rest);
};

export default function Dashboard() {
  const { state } = useShop();
  const navigate = useNavigate();
  const dashboardStats = state.dashboard;
  const [salesData, setSalesData] = useState<MonthlySalesData[]>([]);

  useEffect(() => {
    let ignore = false;

    const loadMonthlySales = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
        const response = await fetch(`${apiUrl}/api/reports/monthly-sales`);
        if (!response.ok) throw new Error(`Failed to load monthly sales (${response.status})`);
        const payload = await response.json();
        const fromApi = Array.isArray(payload?.data) ? payload.data : null;
        if (!ignore && fromApi && fromApi.length > 0) {
          setSalesData(fromApi as MonthlySalesData[]);
          return;
        }
      } catch (err) {
        console.warn('Falling back to client-side sales aggregation', err);
      }

      if (!ignore) {
        const fallback = buildMonthlySeries(state.sales);
        setSalesData(fallback);
      }
    };

    void loadMonthlySales();
    return () => {
      ignore = true;
    };
  }, [state.sales]);

  const handleStockAlertsClick = () => {
    navigate('/inventory?filter=out-of-stock');
  };

  // Calculate stats
  const totalProducts = state.products.length;
  const totalInventoryValueFromState = state.products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
  const lowStockProducts = state.products.filter(product => product.quantity > 0 && product.quantity <= product.reorderPoint);
  const outOfStockProducts = state.products.filter(product => product.quantity <= 0);
  const totalSalesToday = state.sales
    .filter(sale => sale.date === new Date().toISOString().split('T')[0])
    .reduce((sum, sale) => sum + sale.total, 0);
  const totalSalesFromState = state.sales.reduce((sum, sale) => sum + sale.total, 0);
  const ordersFromState = state.sales.length;

  const dashboardTotalSales = Number(dashboardStats?.totalSales ?? 0);
  const dashboardInventoryValue = Number(dashboardStats?.inventoryValue ?? 0);
  const dashboardOrders = Number(dashboardStats?.orders ?? 0);
  const dashboardLowStock = Number(dashboardStats?.lowStock ?? 0);
  const dashboardOutOfStock = Number(dashboardStats?.outOfStock ?? 0);

  const totalSales = dashboardTotalSales || totalSalesFromState;
  const totalInventoryValue = dashboardInventoryValue || totalInventoryValueFromState;
  const totalOrders = dashboardOrders || ordersFromState;
  const lowStockCount = lowStockProducts.length;
  const outOfStockCount = outOfStockProducts.length;
  const maxSalesValue = Math.max(1, ...salesData.map((d) => d.value || 0));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your store performance and inventory
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalSales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +10% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalInventoryValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalProducts} products in stock
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Total completed orders
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer" onClick={handleStockAlertsClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockCount}</div>
              <p className="text-xs text-muted-foreground">
                Low stock (&lt;= reorder point)
              </p>
              <p className="text-lg text-muted-foreground font-bold  mt-1">
               Out of stock: {outOfStockCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <p className="text-sm text-muted-foreground">
                ₹{totalSales.toLocaleString()} <span className="text-success">+10%</span>
              </p>
              <p className="text-xs text-muted-foreground">Last 30 Days</p>
            </CardHeader>
            <CardContent>
              {salesData.length > 0 ? (
                <div className="h-48 flex items-end space-x-2">
                  {salesData.map((data, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-primary rounded-t"
                        style={{ height: `${(data.value / maxSalesValue) * 150}px` }}
                        title={`${data.month} ${data.year}: ₹${data.value.toLocaleString()}`}
                      />
                      <span className="text-xs text-muted-foreground mt-2">{data.month}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No sales data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dashboard Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Products</span>
                  <span className="font-semibold">{totalProducts}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Low Stock Items</span>
                  <span className="font-semibold text-orange-600">{lowStockCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Out of Stock</span>
                  <span className="font-semibold text-red-600">{outOfStockCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <span className="font-semibold">{totalOrders}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Inventory Value</span>
                  <span className="font-semibold">₹{totalInventoryValue.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Status */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <span className="font-medium truncate">Product</span>
                  <span className="font-medium truncate">Product ID</span>
                  <span className="font-medium text-right">Stock</span>
                  <span className="font-medium text-right">Reorder Point</span>
                </div>
                {state.products.slice(0, 5).map((product) => (
                  <div key={product.id} className="grid grid-cols-4 gap-4 items-center text-sm">
                    <span className="truncate">{product.name}</span>
                    <span className="truncate">{product.productId || product.sku}</span>
                    <span className="text-right">{product.quantity}</span>
                    <span className="text-right">{product.reorderPoint}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}