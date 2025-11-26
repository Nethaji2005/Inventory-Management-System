import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useShop } from '@/contexts/ShopContext';
import type { DashboardSnapshot, Purchase, Sale } from '@/contexts/ShopContext';
import { CalendarDays, Download } from 'lucide-react';
import { adaptDashboardFromApi, adaptPurchaseFromApi, adaptSaleFromApi } from '@/contextAdapters';

interface ReportSummary {
  totalSales: number;
  totalPurchases: number;
  profit: number;
  salesCount: number;
  purchaseCount: number;
}

interface ReportPayload {
  summary: ReportSummary;
  sales: Sale[];
  purchases: Purchase[];
  dashboard?: DashboardSnapshot;
}

export default function Reports() {
  const { state, dispatch } = useShop();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('all');
  const [reportData, setReportData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get date range based on preset
  const getDateRange = (preset: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start.setDate(today.getDate() - today.getDay());
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        return { start: null, end: null };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Handle preset selection
  const handlePresetSelect = (preset: string) => {
    setDateRangePreset(preset);
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else {
      const { start, end } = getDateRange(preset);
      setStartDate(start || '');
      setEndDate(end || '');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();

    if (startDate) {
      query.append('startDate', startDate);
    }

    if (endDate) {
      query.append('endDate', endDate);
    }

      const fetchReports = async () => {
        setLoading(true);
        setError(null);

        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
          const url = query.toString()
            ? `${apiUrl}/api/reports?${query.toString()}`
            : `${apiUrl}/api/reports`;        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load reports (status ${response.status})`);
        }

        const rawPayload = await response.json();

        const normalizedSales = Array.isArray(rawPayload?.sales)
          ? rawPayload.sales.map(adaptSaleFromApi)
          : [];

        const normalizedPurchases = Array.isArray(rawPayload?.purchases)
          ? rawPayload.purchases.map(adaptPurchaseFromApi)
          : [];

        const normalizedSummary: ReportSummary = {
          totalSales: Number(rawPayload?.summary?.totalSales ?? 0),
          totalPurchases: Number(rawPayload?.summary?.totalPurchases ?? 0),
          profit: Number(rawPayload?.summary?.profit ?? (Number(rawPayload?.summary?.totalSales ?? 0) - Number(rawPayload?.summary?.totalPurchases ?? 0))),
          salesCount: Number(rawPayload?.summary?.salesCount ?? normalizedSales.length),
          purchaseCount: Number(rawPayload?.summary?.purchaseCount ?? normalizedPurchases.length),
        };

        const normalizedDashboard: DashboardSnapshot | null = rawPayload?.dashboard
          ? adaptDashboardFromApi(rawPayload.dashboard)
          : null;

        const payload: ReportPayload = {
          summary: normalizedSummary,
          sales: normalizedSales,
          purchases: normalizedPurchases,
          dashboard: normalizedDashboard ?? undefined,
        };

        setReportData(payload);

        if (!startDate && !endDate) {
          dispatch({ type: 'SET_SALES', payload: normalizedSales });
          dispatch({ type: 'SET_PURCHASES', payload: normalizedPurchases });
        }

        if (normalizedDashboard) {
          dispatch({ type: 'SET_DASHBOARD', payload: normalizedDashboard });
        } else if (!startDate && !endDate) {
          const computedDashboard: DashboardSnapshot = {
            totalSales: normalizedSummary.totalSales,
            inventoryValue: state.products.reduce((sum, product) => sum + product.price * product.quantity, 0),
            orders: normalizedSummary.salesCount,
            lowStock: state.products.filter((product) => product.quantity > 0 && product.quantity <= product.reorderPoint).length,
            outOfStock: state.products.filter((product) => product.quantity <= 0).length,
          };
          dispatch({ type: 'SET_DASHBOARD', payload: computedDashboard });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load reports data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load reports');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchReports().catch(() => {
      /* already handled in fetchReports */
    });

    return () => {
      controller.abort();
    };
  }, [dispatch, endDate, startDate]);

  // Filter data by date range
  const filterByDateRange = (data: any[]) => {
    if (!startDate && !endDate) return data;

    return data.filter(item => {
      const itemDate = new Date(item.date).toISOString().split('T')[0];
      const isAfterStart = !startDate || itemDate >= startDate;
      const isBeforeEnd = !endDate || itemDate <= endDate;
      return isAfterStart && isBeforeEnd;
    });
  };

  const filteredSales = useMemo(() => {
    if (reportData) {
      return reportData.sales ?? [];
    }
    return filterByDateRange(state.sales);
  }, [reportData, state.sales, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    if (reportData) {
      return reportData.purchases ?? [];
    }
    return filterByDateRange(state.purchases);
  }, [reportData, state.purchases, startDate, endDate]);

  const computedSummary = useMemo(() => {
    if (reportData?.summary) {
      return reportData.summary;
    }

    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalPurchases = filteredPurchases.reduce((sum, purchase) => sum + purchase.total, 0);
    return {
      totalSales,
      totalPurchases,
      profit: totalSales - totalPurchases,
      salesCount: filteredSales.length,
      purchaseCount: filteredPurchases.length,
    } satisfies ReportSummary;
  }, [filteredPurchases, filteredSales, reportData]);

  const { totalSales, totalPurchases, profit, salesCount, purchaseCount } = computedSummary;

  const salesReport = filteredSales.map(sale => ({
    date: sale.date,
    customer: sale.customerName || 'Walk-in Customer',
    products: sale.products.map(p => p.productName).join(', '),
    quantity: sale.products.reduce((sum, p) => sum + p.quantity, 0),
    unitPrice: sale.products.length > 0 ? sale.products[0].price : 0,
    totalPrice: sale.total
  }));

  const purchaseReport = filteredPurchases.map(purchase => ({
    date: purchase.date,
    supplier: purchase.supplierName || 'Unknown Supplier',
    products: purchase.products.map(p => p.productName).join(', '),
    quantity: purchase.products.reduce((sum, p) => sum + p.quantity, 0),
    unitPrice: purchase.products.length > 0 ? purchase.products[0].price : 0,
    totalPrice: purchase.total
  }));

  // Export to CSV helper
  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground">
              Analyze your business performance and track key metrics
            </p>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-sm text-muted-foreground">Loading reports…</div>
        )}

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Filter by Date Range
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={dateRangePreset === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('all')}
              >
                All Time
              </Button>
              <Button
                variant={dateRangePreset === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('today')}
              >
                Today
              </Button>
              <Button
                variant={dateRangePreset === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('week')}
              >
                This Week
              </Button>
              <Button
                variant={dateRangePreset === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('month')}
              >
                This Month
              </Button>
            </div>

            {/* Custom Date Range */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateRangePreset('custom');
                  }}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateRangePreset('custom');
                  }}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₹{totalSales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {salesCount} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">₹{totalPurchases.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {purchaseCount} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
               <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                 ₹{profit.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Profit margin: {totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales">Sales Report</TabsTrigger>
            <TabsTrigger value="purchase">Purchase Report</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sales">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sales Report</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(salesReport, `sales_report_${startDate}_${endDate}.csv`)}
                  disabled={salesReport.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Total Records: {salesReport.length}
                  </div>
                  <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground">
                    <span>Date</span>
                    <span>Customer</span>
                    <span>Product</span>
                    <span>Quantity</span>
                    <span>Unit Price</span>
                    <span>Total Price</span>
                  </div>
                  
                  {salesReport.map((sale, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 items-center py-2 text-sm border-b">
                      <span>{sale.date}</span>
                      <span>{sale.customer}</span>
                      <span className="truncate">{sale.products}</span>
                      <span>{sale.quantity}</span>
                       <span>₹{sale.unitPrice.toFixed(2)}</span>
                       <span className="font-medium">₹{sale.totalPrice.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  {salesReport.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No sales data available for the selected date range
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="purchase">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Purchase Report</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(purchaseReport, `purchase_report_${startDate}_${endDate}.csv`)}
                  disabled={purchaseReport.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Total Records: {purchaseReport.length}
                  </div>
                  <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground">
                    <span>Date</span>
                    <span>Supplier</span>
                    <span>Product</span>
                    <span>Quantity</span>
                    <span>Unit Price</span>
                    <span>Total Price</span>
                  </div>
                  
                  {purchaseReport.map((purchase, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 items-center py-2 text-sm border-b">
                      <span>{purchase.date}</span>
                      <span>{purchase.supplier}</span>
                      <span className="truncate">{purchase.products}</span>
                      <span>{purchase.quantity}</span>
                       <span>₹{purchase.unitPrice.toFixed(2)}</span>
                       <span className="font-medium">₹{purchase.totalPrice.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  {purchaseReport.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No purchase data available for the selected date range
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}