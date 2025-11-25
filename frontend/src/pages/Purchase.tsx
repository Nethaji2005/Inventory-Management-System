import { useState, useMemo } from 'react';
import { adaptDashboardFromApi, adaptProductFromApi } from '@/contextAdapters';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShop } from '@/contexts/ShopContext';
import { Product } from '@/contexts/ShopContext';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PurchaseItem {
  productId: string;
  productName: string;
  size: string;
  gsm: string;
  sqFt: number;
  quantity: string | number;
  price: string | number;
  pricePerQuantity: number;
  total: number
}

export default function Purchase() {
  const { state, dispatch } = useShop();
  const [searchTerm, setSearchTerm] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [supplierBillId, setSupplierBillId] = useState('');
  const [supplierName, setSupplierName] = useState('');
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

  // Calculate Price Per Quantity: sqFt * pricePerSqFt
  function calculatePricePerQuantity(sqFt: number, pricePerSqFt: string | number): number {
    const price = parseFloat(pricePerSqFt as string) || 0;
    return sqFt * price;
  }

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

  const addProduct = (productId: string) => {
    const product = state.products.find((p: Product) => p.id === productId);
    if (!product) return;

    const productSku = product.productId || product.sku;
    const sqFt = calculateSqFt(product.size);
    const existingItem = purchaseItems.find(item => item.productId === productSku);
    if (existingItem) {
      const currentQuantity = parseInt(existingItem.quantity as string) || 0;
      const newQuantity = currentQuantity + 1;
      const parsedPrice = parseFloat(existingItem.price as string) || product.price;
      const pricePerQty = calculatePricePerQuantity(existingItem.sqFt, parsedPrice);
      setPurchaseItems(items => 
        items.map(item => 
          item.productId === productSku 
            ? { ...item, quantity: newQuantity.toString(), pricePerQuantity: pricePerQty, total: newQuantity * pricePerQty }
            : item
        )
      );
    } else {
      const pricePerQty = calculatePricePerQuantity(sqFt, product.price);
      setPurchaseItems(items => [...items, {
        productId: productSku,
        productName: product.name,
        size: product.size || '',
        gsm: product.gsm || '',
        sqFt: sqFt,
        quantity: '',
        price: product.price.toString(),
        pricePerQuantity: pricePerQty,
        total: 0
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: string) => {
    // Allow empty string for editing
    if (quantity === '') {
      setPurchaseItems(items => 
        items.map(item => 
          item.productId === productId 
            ? { ...item, quantity: '', total: 0 }
            : item
        )
      );
      return;
    }

    const numQuantity = parseInt(quantity) || 0;
    if (numQuantity < 0) {
      return; // Don't allow negative values
    }
    
    setPurchaseItems(items => 
      items.map(item => {
        return item.productId === productId 
          ? { ...item, quantity, total: numQuantity * item.pricePerQuantity }
          : item;
      })
    );
  };

  const updatePrice = (productId: string, price: string) => {
    const numPrice = parseFloat(price) || 0;
    setPurchaseItems(items => 
      items.map(item => {
        const parsedQuantity = parseInt(item.quantity as string) || 0;
        const pricePerQty = calculatePricePerQuantity(item.sqFt, numPrice);
        return item.productId === productId 
          ? { ...item, price, pricePerQuantity: pricePerQty, total: parsedQuantity * pricePerQty }
          : item;
      })
    );
  };

  const removeProduct = (productId: string) => {
    setPurchaseItems(items => items.filter(item => item.productId !== productId));
  };

  const getParsedTotal = (item: PurchaseItem) => {
    const parsedQuantity = parseInt(item.quantity as string) || 0;
    
    // If quantity is 0 or blank, return 0
    if (parsedQuantity <= 0) {
      return 0;
    }
    
    // Formula: total = pricePerQuantity * quantity
    return item.pricePerQuantity * parsedQuantity;
  };

  const subtotal = purchaseItems.reduce((sum, item) => sum + getParsedTotal(item), 0);
  const tax = subtotal * 0.18; // 18% tax
  const total = subtotal + tax;

  const handleSetProductName = (v: string) => {
    setProductName(v);
    setSizeFilter("");
    setGsmFilter("");
  };

  const handleRecordPurchase = async () => {
    if (purchaseItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add products to the purchase",
        variant: "destructive",
      });
      return;
    }

    // Validation
    for (const item of purchaseItems) {
      const numQuantity = parseInt(item.quantity as string) || 0;
      const numPrice = parseFloat(item.price as string) || 0;
      if (numQuantity <= 0 || numPrice <= 0) {
        toast({
          title: "Error",
          description: "Quantity and price per sq.ft must be greater than 0 for all items",
          variant: "destructive",
        });
        return;
      }
    }

    const parsedProducts = purchaseItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: parseInt(item.quantity as string),
      price: parseFloat(item.price as string),
      total: getParsedTotal(item)
    }));

    try {
      const payload = {
        billId: supplierBillId || `PUR-${Date.now()}`,
        supplierName: supplierName || 'Unknown Supplier',
        subtotal,
        tax,
        total,
        items: parsedProducts.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const response = await fetch('http://localhost:5000/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let message = 'Failed to record purchase';
        try {
          const err = await response.json();
          message = err.error || message;
        } catch (err) {
          // ignore json parse error
        }
        throw new Error(message);
      }

      const data = await response.json();

      const updatedProducts = Array.isArray(data?.updatedProducts)
        ? data.updatedProducts.map((entry: any) => adaptProductFromApi(entry))
        : [];

      if (updatedProducts.length > 0) {
        const map = new Map<string, Product>(updatedProducts.map((p) => [p.id, p]));
        const merged: Product[] = state.products.map((product) => map.get(product.id) ?? product);

        updatedProducts.forEach((product) => {
          if (!merged.find((p) => p.id === product.id)) {
            merged.push(product);
          }
        });

        dispatch({ type: 'SET_PRODUCTS', payload: merged });
      }

      if (data?.purchase) {
        const createdAt = data.purchase.createdAt || new Date().toISOString();
        const normalizedPurchase = {
          id: data.purchase._id ?? Date.now().toString(),
          date: new Date(createdAt).toISOString().split('T')[0],
          supplierName: data.purchase.supplierName || payload.supplierName,
          products: (data.purchase.items || []).map((item: any) => ({
            productId: String(item.productId),
            productName: item.productName,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            total: Number(item.total) || 0
          })),
          subtotal: Number(data.purchase.subtotal ?? payload.subtotal ?? 0),
          tax: Number(data.purchase.tax ?? payload.tax ?? 0),
          total: Number(data.purchase.total ?? payload.total ?? 0),
          billId: data.purchase.billId || payload.billId
        };

        dispatch({
          type: 'ADD_PURCHASE',
          payload: normalizedPurchase,
          meta: { updateInventory: updatedProducts.length === 0 },
        });
      }

      if (data?.dashboard) {
        dispatch({ type: 'SET_DASHBOARD', payload: adaptDashboardFromApi(data.dashboard) });
      }

      // Reset form
      setPurchaseItems([]);
      setSupplierBillId('');
      setSupplierName('');
      setSearchTerm('');
      setProductName('');
      setSizeFilter('');
      setGsmFilter('');

      toast({
        title: "Purchase Recorded",
        description: `Purchase of ₹${total.toFixed(2)} has been recorded successfully`,
      });
    } catch (error) {
      console.error('Error recording purchase:', error);
      toast({
        title: "Error",
        description: "Failed to record purchase. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Products</h1>
          <p className="text-muted-foreground">
            Add new stock to your inventory
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Product Selection */}
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Select Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search product by name or product id"
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

                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">Product ID: {product.productId || product.sku} | Stock: {product.quantity} | Size: {product.size} | GSM: {product.gsm}</p>
                      </div>
                      <Button size="sm" onClick={() => addProduct(product.id)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Purchase Items */}
            {purchaseItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 overflow-x-auto">
                    <div className="hidden md:grid grid-cols-7 gap-4 text-xs md:text-sm font-medium text-muted-foreground pb-2 border-b">
                      <span>Product</span>
                      <span>Sq.Ft</span>
                      <span>Price/Sq.Ft</span>
                      <span>Price/Qty</span>
                      <span>Quantity</span>
                      <span>Total</span>
                      <span></span>
                    </div>
                    
                    {purchaseItems.map((item) => (
                      <div key={item.productId} className="block md:grid md:grid-cols-7 md:gap-4 md:items-center border rounded-lg p-3 md:p-0 md:border-0 md:py-2">
                        <div className="mb-3 md:mb-0">
                          <span className="font-medium block text-sm md:text-base">{item.productName}</span>
                          <span className="text-xs text-muted-foreground">Size: {item.size} | GSM: {item.gsm}</span>
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Sq.Ft: </span>
                          <span className="text-sm font-medium bg-muted px-2 py-1 rounded inline-block">{item.sqFt}</span>
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Price/Sq.Ft: </span>
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => updatePrice(item.productId, e.target.value)}
                            className="w-full h-8 text-sm"
                            step="0.01"
                            placeholder="Price/Sq.Ft"
                            title="Price per square foot"
                          />
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Price/Qty: </span>
                          <div className="text-sm font-medium bg-muted px-2 py-1 rounded">₹{item.pricePerQuantity.toFixed(2)}</div>
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Qty: </span>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productId, e.target.value)}
                            className="w-full h-8 text-sm"
                            min="1"
                            placeholder="0"
                          />
                        </div>
                        <div className="mb-3 md:mb-0">
                          <span className="md:hidden text-xs text-muted-foreground">Total: </span>
                          <span className="font-medium text-sm md:text-base">₹{getParsedTotal(item).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => removeProduct(item.productId)}
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

          {/* Purchase Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="billId">Bill ID</Label>
                  <Input
                    id="billId"
                    placeholder="Enter supplier bill ID"
                    value={supplierBillId}
                    onChange={(e) => setSupplierBillId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    placeholder="Select a supplier"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </div>

                <div className="pt-4 space-y-2 border-t">
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
                  onClick={handleRecordPurchase}
                  disabled={purchaseItems.length === 0}
                >
                  Record Purchase
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}