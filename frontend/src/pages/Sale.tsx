import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShop } from '@/contexts/ShopContext';
import { Product } from '@/contexts/ShopContext';
import { Search, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { adaptDashboardFromApi, adaptProductFromApi, adaptSaleFromApi } from '@/contextAdapters';

interface SaleItem {
  id: string;
  productName: string;
  size: string;
  gsm: string;
  sqFt: number;
  quantity: string | number;
  price: string | number;
  pricePerQuantity: number; // sqFt * price - read-only calculated field
  total: number;
}

export default function Sale() {
  const { state, dispatch } = useShop();
  const [customerName, setCustomerName] = useState('');
  const [billId, setBillId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [productName, setProductName] = useState<string>("");
  const [sizeFilter, setSizeFilter] = useState<string>("");
  const [gsmFilter, setGsmFilter] = useState<string>("");

  function normalizeSize(s: any): string {
    if (s == null) return "";
    return String(s).trim();
  }

  function normalizeGsm(g: any): string {
    if (g == null) return "";
    return String(g).trim();
  }

  // Calculate Sq.Ft from size string (e.g., "9 X 6" = 54)
  function calculateSqFt(size: string): number {
    if (!size) return 0;
    const parts = size.split('X').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * parts[1];
    }
    return 0;
  }

  // Derived lists for select options
  const allProducts = state.products || [];

  const productNames = useMemo(() => {
    const names = allProducts
      .map((p: any) => String(p.name || "").trim())
      .filter(Boolean);

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const sizesForSelectedProduct = useMemo(() => {
    // if no selection, return all unique sizes
    const filtered = productName
      ? allProducts.filter((p: any) => String(p.name).trim() === productName)
      : allProducts;

    return Array.from(new Set(filtered.map((p:any) => normalizeSize(p.size)).filter(Boolean))).sort();
  }, [allProducts, productName]);

  const gsmsForSelectedProduct = useMemo(() => {
    const filtered = productName
      ? allProducts.filter((p: any) => String(p.name).trim() === productName)
      : allProducts;

    return Array.from(new Set(filtered.map((p:any) => String(p.gsm).trim()).filter(Boolean))).sort((a,b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [allProducts, productName]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      if (product.quantity <= 0) return false;

      // product name / id filter
      if (productName) {
        const matchesName = String(product.name).trim() === productName;
        if (!matchesName) return false;
      }

      // size filter
      if (sizeFilter) {
        if (normalizeSize(product.size) !== sizeFilter) return false;
      }

      // gsm filter
      if (gsmFilter) {
        if (normalizeGsm(product.gsm) !== gsmFilter) return false;
      }

      // existing search term filter
      if (searchTerm) {
        const term = searchTerm.toString().toLowerCase();
        if (!product.name.toLowerCase().includes(term) && !(product.productId || product.sku)?.toLowerCase().includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [allProducts, searchTerm, productName, sizeFilter, gsmFilter]);

  const addProductToSale = (productEntryId: string) => {
    const product = state.products.find((p: Product) => p.id === productEntryId);
    if (!product || product.quantity === 0) return;

    const productSku = product.productId || product.sku;
    const sqFt = calculateSqFt(product.size);
    const pricePerQuantity = sqFt * product.price;
    const existingItem = saleItems.find(item => item.id === productSku);
    if (existingItem) {
      const currentQuantity = parseInt(existingItem.quantity as string) || 0;
      if (currentQuantity >= product.quantity) {
        toast({
          title: "Insufficient Stock",
          description: `Only ${product.quantity} items available`,
          variant: "destructive",
        });
        return;
      }
      
      const newQuantity = currentQuantity + 1;
      setSaleItems(items => 
        items.map(item => {
          const parsedPrice = parseFloat(item.price as string) || 0;
          const pricePerQty = item.sqFt * parsedPrice;
          return item.id === productSku 
            ? { ...item, quantity: newQuantity.toString(), pricePerQuantity: pricePerQty, total: newQuantity * pricePerQty }
            : item;
        }
      )
    );
    } else {
      setSaleItems(items => [...items, {
        id: productSku,
        productName: product.name,
        size: product.size || '',
        gsm: product.gsm || '',
        sqFt: sqFt,
        quantity: '',
        price: product.price,
        pricePerQuantity: pricePerQuantity,
        total: 0
      }]);
    }
  };

  const updateQuantity = (productEntryId: string, quantity: string) => {
    if (quantity === '') {
      setSaleItems(items => 
        items.map(item => 
          item.id === productEntryId 
            ? { ...item, quantity: '', total: 0 }
            : item
        )
      );
      return;
    }

    const numQuantity = parseInt(quantity) || 0;
    if (numQuantity < 1) {
      return; // Don't remove product if input is invalid
    }

    const product = state.products.find((p: Product) => 
      (p.productId === productEntryId || p.sku === productEntryId)
    );
    if (!product || numQuantity > product.quantity) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${product?.quantity || 0} items available`,
        variant: "destructive",
      });
      return;
    }
    
    setSaleItems(items => 
      items.map(item => 
        item.id === productEntryId 
          ? { ...item, quantity, total: numQuantity * item.pricePerQuantity }
          : item
      )
    )
  };

  const updatePrice = (productEntryId: string, priceStr: string) => {
    const price = parseFloat(priceStr) || 0;
    if (price < 0) return;
    
    setSaleItems(items =>
      items.map(item =>
        item.id === productEntryId
          ? { 
              ...item, 
              price, 
              pricePerQuantity: item.sqFt * price,
              total: (parseInt(item.quantity as string) || 0) * (item.sqFt * price)
            }
          : item
      )
    );
  };

  const removeProduct = (productEntryId: string) => {
    setSaleItems(items => items.filter(item => item.id !== productEntryId));
  };

  const getParsedTotal = (item: SaleItem) => {
    const parsedQuantity = parseInt(item.quantity as string) || 0;
    
    // If quantity is 0 or blank, return 0
    if (parsedQuantity <= 0) {
      return 0;
    }
    
    // Formula: total = pricePerQuantity * quantity
    return item.pricePerQuantity * parsedQuantity;
  };

  const subtotal = saleItems.reduce((sum, item) => sum + getParsedTotal(item), 0);
  const tax = subtotal * 0.18; // 18% tax
  const total = subtotal + tax;

  const handleSetProductName = (v: string) => {
    setProductName(v);
    setSizeFilter("");
    setGsmFilter("");
  };

  const handleGenerateInvoice = async () => {
    // Filter out items with no quantity
    const validItems = saleItems.filter(item => {
      const numQuantity = parseInt(item.quantity as string) || 0;
      const numPrice = parseFloat(item.price as string) || 0;
      return numQuantity > 0 && numPrice > 0;
    });

    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add products with valid quantities and price per sq.ft to the sale",
        variant: "destructive",
      });
      return;
    }

    const parsedProducts = validItems.map(item => ({
      productId: item.id,
      productName: item.productName,
      quantity: parseInt(item.quantity as string),
      price: item.price,
      pricePerQuantity: item.pricePerQuantity,
      total: getParsedTotal(item)
    }));

    try {
      const payload = {
        billId: billId || `INV-${Date.now()}`,
        customerName: customerName || 'Walk-in Customer',
        subtotal,
        tax,
        total,
        items: parsedProducts.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          pricePerQuantity: item.pricePerQuantity
        })),
        invoiceDate,
      };

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let message = 'Failed to generate invoice';
        try {
          const err = await response.json();
          message = err.error || message;
        } catch (parseErr) {
          // swallow parse error and use default message
        }
        throw new Error(message);
      }

      const data = await response.json();

      const updatedProducts = Array.isArray(data?.updatedProducts)
        ? data.updatedProducts.map((entry: any) => adaptProductFromApi(entry))
        : [];

      if (updatedProducts.length > 0) {
        const updatedMap = new Map<string, Product>(
          updatedProducts.map((product) => [product.id, product])
        );

        const mergedProducts: Product[] = state.products.map((product) =>
          updatedMap.get(product.id) ?? product
        );

        updatedProducts.forEach((product) => {
          if (!mergedProducts.find((existing) => existing.id === product.id)) {
            mergedProducts.push(product);
          }
        });

        dispatch({ type: 'SET_PRODUCTS', payload: mergedProducts });
      }

      if (data?.sale) {
        const normalizedSale = adaptSaleFromApi(data.sale);
        dispatch({
          type: 'ADD_SALE',
          payload: normalizedSale,
          meta: { updateInventory: updatedProducts.length === 0 },
        });
      }

      if (data?.dashboard) {
        dispatch({ type: 'SET_DASHBOARD', payload: adaptDashboardFromApi(data.dashboard) });
      }
      // Reset form
      setSaleItems([]);
      setCustomerName('');
      setBillId('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setSearchTerm('');
      setProductName('');
      setSizeFilter('');
      setGsmFilter('');

      const toastBillId = data?.sale?.billId || payload.billId;
      toast({
        title: "Sale Recorded",
        description: `Invoice ${toastBillId} generated successfully for ₹${total.toFixed(2)}`,
      });
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sale & Billing</h1>
          <p className="text-muted-foreground">
            Efficiently process sales and generate invoices
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Billing Details */}
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Billing Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billId">Bill ID</Label>
                  <Input
                    id="billId"
                    placeholder="Enter bill ID"
                    value={billId}
                    onChange={(e) => setBillId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Product</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for products to add to the bill"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <select
                      id="productName"
                      value={productName}
                      onChange={(e) => handleSetProductName(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">All Products</option>
                      {productNames.map((pn) => (
                        <option key={pn} value={pn}>
                          {pn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sizeFilter">Size</Label>
                    <select
                      id="sizeFilter"
                      value={sizeFilter}
                      onChange={(e) => setSizeFilter(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">All Sizes</option>
                      {sizesForSelectedProduct.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gsmFilter">GSM</Label>
                    <select
                      id="gsmFilter"
                      value={gsmFilter}
                      onChange={(e) => setGsmFilter(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">All GSM</option>
                      {gsmsForSelectedProduct.map((gsm) => (
                        <option key={gsm} value={gsm}>{gsm}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                      onClick={() => addProductToSale(product.id)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Price/Sq.Ft: ₹{product.price.toFixed(2)} | Stock: {product.quantity} | Size: {product.size} | GSM: {product.gsm} | Price/Qty: ₹{(calculateSqFt(product.size) * product.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sale Items */}
            {saleItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Products in Bill</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 overflow-x-auto">
                    <div className="hidden md:grid grid-cols-7 gap-4 text-xs md:text-sm font-medium text-muted-foreground pb-2 border-b">
                      <span>Product</span>
                      <span>Sq.Ft</span>
                      <span>Quantity</span>
                      <span>Price/Sq.Ft</span>
                      <span>Price/Qty</span>
                      <span>Total</span>
                      <span></span>
                    </div>
                    
                    {saleItems.map((item) => (
                      <div key={item.id} className="block md:grid md:grid-cols-7 md:gap-4 md:items-center border rounded-lg p-3 md:p-0 md:border-0 md:py-2">
                        <div className="mb-3 md:mb-0">
                          <span className="font-medium block text-sm md:text-base">{item.productName}</span>
                          <span className="text-xs text-muted-foreground">Size: {item.size} | GSM: {item.gsm}</span>
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Sq.Ft: </span>
                          <span className="text-sm font-medium bg-muted px-2 py-1 rounded inline-block">{item.sqFt}</span>
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Qty: </span>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, e.target.value)}
                            className="w-full h-8 text-sm"
                            min="1"
                            placeholder="0"
                          />
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Price/Sq.Ft: </span>
                          <Input
                            type="number"
                            value={item.price || ''}
                            onChange={(e) => updatePrice(item.id, e.target.value)}
                            className="w-full h-8 text-sm"
                            min="0"
                            step="0.01"
                            placeholder="Price/Sq.Ft"
                            title="Price per square foot"
                          />
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Price/Qty: </span>
                          <span className="text-sm font-medium bg-muted px-2 py-1 rounded inline-block">₹{item.pricePerQuantity.toFixed(2)}</span>
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Total: </span>
                          <span className="font-medium text-sm md:text-base">₹{getParsedTotal(item).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => removeProduct(item.id)}
                            className="w-full md:w-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                     <span>₹{subtotal.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>Tax (18%)</span>
                     <span>₹{tax.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between font-bold text-lg border-t pt-2">
                     <span>Total</span>
                     <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleGenerateInvoice}
                  disabled={saleItems.length === 0}
                >
                  Generate Invoice
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}