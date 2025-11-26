import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useShop } from '@/contexts/ShopContext';
import { Product } from '@/contexts/ShopContext';
import { Search, Edit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeSizeString } from '@/utils/normalize';
import FilterQuickMenu from '@/components/FilterQuickMenu';

type ProductApiResponse = Partial<Product> & {
  _id?: string;
  id?: string;
};

export default function Inventory() {
  const { state, dispatch } = useShop();
  const location = useLocation();
  const navigate = useNavigate();
  const hasFetchedProductsRef = useRef(false);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [fetchProductsError, setFetchProductsError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const quickFilterButtonRef = useRef<HTMLButtonElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{ name: string; productId: string; price: string; quantity: string; reorderPoint: string; size: string; gsm: string; id: string } | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    productId: '',
    price: '',
    quantity: '',
    reorderPoint: '10',
    size: '',
    gsm: ''
  });

  const adaptProductFromApi = useCallback((product: ProductApiResponse): Product => {
    const fallbackIdSource =
      product?._id ??
      product?.id ??
      product?.productId ??
      product?.sku ??
      product?.name ??
      `temp-${Math.random().toString(36).slice(2)}`;

    const id = String(fallbackIdSource);
    const productId = String(
      product?.productId ?? product?.sku ?? fallbackIdSource
    );
    const sku = String(product?.sku ?? productId);

    return {
      id,
      name: product?.name ?? '',
      sku,
      productId,
      price: Number(product?.price ?? 0),
      quantity: Number(product?.quantity ?? 0),
      reorderPoint: Number(product?.reorderPoint ?? 10),
      size: product?.size ?? '',
      gsm: product?.gsm ?? '',
      image: product?.image ?? undefined
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsFetchingProducts(true);
    setFetchProductsError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
      const response = await fetch(`${apiUrl}/api/products`);
      if (!response.ok) {
        throw new Error(`Failed to load products (status ${response.status})`);
      }

      const payload = await response.json();
      const normalizedProducts = Array.isArray(payload)
        ? payload.map(adaptProductFromApi)
        : [];

      dispatch({ type: 'SET_PRODUCTS', payload: normalizedProducts });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load products.';
      setFetchProductsError(message);
      toast({
        title: 'Failed to load inventory',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsFetchingProducts(false);
    }
  }, [adaptProductFromApi, dispatch]);

  const updateStockFilter = useCallback((nextFilter: 'all' | 'low' | 'out') => {
    setStockFilter(nextFilter);

    const params = new URLSearchParams(location.search);

    if (nextFilter === 'all') {
      params.delete('filter');
    } else if (nextFilter === 'low') {
      params.set('filter', 'low-stock');
    } else if (nextFilter === 'out') {
      params.set('filter', 'out-of-stock');
    }

    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (hasFetchedProductsRef.current) return;
    if (state.products.length > 0) {
      hasFetchedProductsRef.current = true;
      return;
    }

    hasFetchedProductsRef.current = true;
    void fetchProducts();
  }, [state.products.length, fetchProducts]);

  // Parse query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filterParam = params.get('filter');

    if (filterParam === 'low-stock') {
      setStockFilter('low');
      searchInputRef.current?.focus();
    } else if (filterParam === 'out-of-stock') {
      setStockFilter('out');
      searchInputRef.current?.focus();
    } else {
      setStockFilter('all');
    }
  }, [location.search]);

  // Compute unique types for suggestions
  const types = useMemo(() => {
    const uniqueTypes = [...new Set(state.products.map(p => p.type).filter(Boolean))];
    return uniqueTypes;
  }, [state.products]);

  // Outside-click / Escape handler for filter dropdown
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!filterOpen) return;
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const filteredProducts = state.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.productId || product.sku).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStockFilter =
      stockFilter === 'all' ||
      (stockFilter === 'low' && product.quantity > 0 && product.quantity <= product.reorderPoint) ||
      (stockFilter === 'out' && product.quantity <= 0);
    return matchesSearch && matchesStockFilter;
  });

  const getStockStatus = (product: Product) => {
    if (product.quantity === 0) return { status: 'Out of Stock', variant: 'destructive' as const };
    if (product.quantity <= product.reorderPoint) return { status: 'Low Stock', variant: 'warning' as const };
    return { status: 'In Stock', variant: 'success' as const };
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.productId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const numPrice = parseFloat(newProduct.price as string) || 0;
    const numQuantity = parseInt(newProduct.quantity as string) || 0;
    const numReorderPoint = parseInt(newProduct.reorderPoint) || 10;

    try {
      // Let the backend handle duplicate checking and quantity updates
      console.log('📤 Sending product to backend:', {
        name: newProduct.name,
        sku: newProduct.productId.toUpperCase(),
        price: numPrice,
        quantity: numQuantity,
      });
      
      const apiUrl = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
      const response = await fetch(`${apiUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProduct.name,
          sku: newProduct.productId.toUpperCase(),
          price: numPrice,
          quantity: numQuantity,
          reorderPoint: numReorderPoint,
          size: newProduct.size,
          gsm: newProduct.gsm
        }),
      });

      console.log('📥 Backend response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        let errorMessage = 'Failed to save product';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const savedProduct = await response.json();
      const normalizedProduct = adaptProductFromApi(savedProduct);

      // Check if this was an update or new product based on response
      const existingProductIndex = state.products.findIndex(p =>
        p.productId.toLowerCase() === normalizedProduct.productId.toLowerCase()
      );

      if (existingProductIndex !== -1) {
        // Product was updated
        dispatch({ type: 'UPDATE_PRODUCT', payload: normalizedProduct });

        toast({
          title: "Product Updated",
          description: `${normalizedProduct.name} quantity has been increased by ${numQuantity}`,
        });
      } else {
        // New product was added
        dispatch({ type: 'ADD_PRODUCT', payload: normalizedProduct });

        toast({
          title: "Product Added",
          description: `${normalizedProduct.name} has been added to inventory`,
        });
      }

      setNewProduct({ name: '', productId: '', price: '', quantity: '', reorderPoint: '10', size: '', gsm: '' });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('❌ Error saving product:', error);
      let errorMessage = 'Failed to save product. Please try again.';
      
      if (error instanceof TypeError) {
        console.error('Network error details:', error.message);
        if (error.message.includes('fetch')) {
          errorMessage = 'Cannot connect to server. Backend running on https://inventory-management-system-xyg3.onrender.com/ ? Check console.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;

    const numPrice = parseFloat(editingProduct.price) || 0;
    const numQuantity = parseInt(editingProduct.quantity) || 0;
    const numReorderPoint = parseInt(editingProduct.reorderPoint) || 10;

    try {
      console.log('📤 Updating product:', {
        id: editingProduct.id,
        name: editingProduct.name,
        sku: editingProduct.productId.toUpperCase(),
      });

      const apiUrl = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
      const response = await fetch(`${apiUrl}/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingProduct.name,
          sku: editingProduct.productId.toUpperCase(),
          price: numPrice,
          quantity: numQuantity,
          reorderPoint: numReorderPoint,
          size: editingProduct.size,
          gsm: editingProduct.gsm
        }),
      });

      console.log('📥 Backend response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        let errorMessage = 'Failed to update product';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const updatedProduct = adaptProductFromApi(await response.json());
      dispatch({ type: 'UPDATE_PRODUCT', payload: updatedProduct });

      setIsEditDialogOpen(false);
      setEditingProduct(null);

      toast({
        title: "Product Updated",
        description: `${updatedProduct.name} has been updated`,
      });
    } catch (error) {
      console.error('❌ Error updating product:', error);
      let errorMessage = 'Failed to update product. Please try again.';
      
      if (error instanceof TypeError) {
        console.error('Network error details:', error.message);
        if (error.message.includes('fetch')) {
          errorMessage = 'Cannot connect to server. Please check your backend connection.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(`Delete ${product.name}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingProductId(product.id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
      const response = await fetch(`${apiUrl}/api/products/${product.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let message = 'Failed to delete product';
        try {
          const payload = await response.json();
          message = payload?.error || message;
        } catch {
          message = `${message} (status ${response.status})`;
        }
        throw new Error(message);
      }

      dispatch({ type: 'DELETE_PRODUCT', payload: product.id });
      toast({
        title: 'Product deleted',
        description: `${product.name} has been removed from inventory`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete product';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingProductId(null);
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct({
      id: product.productId || product.sku,
      name: product.name,
      productId: product.productId || product.sku,
      price: product.price > 0 ? product.price.toString() : '',
      quantity: product.quantity > 0 ? product.quantity.toString() : '',
      reorderPoint: product.reorderPoint > 0 ? product.reorderPoint.toString() : '10',
      size: product.size || '',
      gsm: product.gsm || ''
    });
    setIsEditDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground">
              Manage your product inventory and stock levels
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fetchProducts()}
              disabled={isFetchingProducts}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetchingProducts ? 'animate-spin' : ''}`}
              />
              {isFetchingProducts ? 'Refreshing…' : 'Refresh'}
            </Button>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Item
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Enter product name"
                      className="pr-10"
                    />

                    {/* Filter icon button - positioned at right corner of input */}
                    <button
                      ref={filterBtnRef}
                      onClick={() => setFilterOpen(v => !v)}
                      aria-haspopup="true"
                      aria-expanded={filterOpen}
                      aria-label="Open product quick filters"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                      type="button"
                    >
                      {/* simple filter svg icon */}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-600">
                        <path d="M3 5h18M6 12h12M10 19h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* Dropdown: small menu that appears under the input, anchored to the right icon */}
                    {filterOpen && (
                      <div ref={filterRef} className="absolute right-0 mt-1 w-44 bg-white border rounded shadow z-50">
                        <div className="px-3 py-2 text-xs text-gray-500">Quick filters</div>
                        <div className="divide-y">
                          {["SILPAULINES", "ROLLS", "HDPE"].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => { setNewProduct({ ...newProduct, name: val }); setFilterOpen(false); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50"
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* removed modal product-name quick-filter (kept Inventory quick filters) */}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productId">Product ID</Label>
                  <Input
                    id="productId"
                    value={newProduct.productId}
                    onChange={(e) => setNewProduct({ ...newProduct, productId: e.target.value })}
                    placeholder="Enter Product ID"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={newProduct.quantity}
                      onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">

                  <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Input
                      id="size"
                      value={newProduct.size}
                      onChange={(e) => {
                        const normalized = normalizeSizeString(e.target.value);
                        setNewProduct({ ...newProduct, size: normalized });
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const paste = e.clipboardData?.getData('text') || '';
                        const normalized = normalizeSizeString(paste);
                        setNewProduct({ ...newProduct, size: normalized });
                      }}
                      placeholder="e.g., 10 x 15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gsm">GSM</Label>
                    <Input
                      id="gsm"
                      value={newProduct.gsm}
                      onChange={(e) => setNewProduct({ ...newProduct, gsm: e.target.value })}
                      placeholder="e.g., 80"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    value={newProduct.reorderPoint}
                    onChange={(e) => setNewProduct({ ...newProduct, reorderPoint: e.target.value })}
                    placeholder="10"
                  />
                </div>
                <Button onClick={handleAddProduct} className="w-full">
                  Add Product
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {fetchProductsError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {fetchProductsError}
          </div>
        )}

        {isFetchingProducts && state.products.length === 0 && (
          <div className="rounded-md border border-muted bg-muted/10 px-4 py-2 text-sm text-muted-foreground">
            Loading inventory…
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="relative flex-1 w-full">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search for items"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {/* removed duplicate left filter icon - kept right-side filter button */}
                  <button
                    ref={quickFilterButtonRef}
                    onClick={() => setQuickMenuOpen(v => !v)}
                    aria-haspopup="true"
                    aria-expanded={quickMenuOpen}
                    aria-label="Open quick filters"
                    className="p-2 rounded hover:bg-gray-100"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M4 6h16M10 12h4M6 18h12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", right: 0, marginTop: 6 }}>
                    <FilterQuickMenu
                      open={quickMenuOpen}
                      onClose={() => setQuickMenuOpen(false)}
                      onSelect={(val) => {
                        setSearchTerm(val);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Stock view:</span>
              <Button
                variant={stockFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateStockFilter('all')}
              >
                All
              </Button>
              <Button
                variant={stockFilter === 'low' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateStockFilter('low')}
              >
                Low stock
              </Button>
              <Button
                variant={stockFilter === 'out' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateStockFilter('out')}
              >
                Out of stock
              </Button>
            </div>
            {types.length > 0 && (
              <div className="type-suggestions mt-2 flex gap-2 flex-wrap">
                {types.map(t => (
                  <button
                    key={t}
                    className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
                    onClick={() => setSearchTerm(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-8 gap-4 text-sm font-medium text-muted-foreground">
                <span>Product</span>
                <span>Product ID</span>
                <span>Size</span>
                <span>GSM</span>
                <span>Price</span>
                <span>Quantity</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              
              {filteredProducts.map((product) => {
                const stockInfo = getStockStatus(product);
                const rowHighlightClass =
                  stockFilter === 'out' && product.quantity <= 0
                    ? 'bg-red-50'
                    : stockFilter === 'low' && product.quantity > 0 && product.quantity <= product.reorderPoint
                      ? 'bg-yellow-50'
                      : '';

                return (
                  <div key={product.id} className={`grid grid-cols-8 gap-4 items-center py-2 border-b ${rowHighlightClass}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {product.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                    <span className="text-sm">{product.productId || product.sku}</span>
                    <span className="text-sm text-muted-foreground">{product.size || '-'}</span>
                    <span className="text-sm text-muted-foreground">{product.gsm || '-'}</span>
                    <span className="font-medium">₹{product.price.toFixed(2)}</span>
                    <span className="font-medium">{product.quantity}</span>
                    <Badge variant={stockInfo.variant}>{stockInfo.status}</Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Edit Product Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            {editingProduct && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Product Name</Label>
                  <Input
                    id="editName"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editProductId">Product ID</Label>
                  <Input
                    id="editProductId"
                    value={editingProduct.productId}
                    onChange={(e) => setEditingProduct({ ...editingProduct, productId: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editPrice">Price</Label>
                    <Input
                      id="editPrice"
                      type="number"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editQuantity">Quantity</Label>
                    <Input
                      id="editQuantity"
                      type="number"
                      value={editingProduct.quantity}
                      onChange={(e) => setEditingProduct({ ...editingProduct, quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">

                  <div className="space-y-2">
                    <Label htmlFor="editSize">Size</Label>
                    <Input
                      id="editSize"
                      value={editingProduct.size}
                      onChange={(e) => {
                        const normalized = normalizeSizeString(e.target.value);
                        setEditingProduct({ ...editingProduct, size: normalized });
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const paste = e.clipboardData?.getData('text') || '';
                        const normalized = normalizeSizeString(paste);
                        setEditingProduct({ ...editingProduct, size: normalized });
                      }}
                      placeholder="e.g., 10 x 15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editGsm">GSM</Label>
                    <Input
                      id="editGsm"
                      value={editingProduct.gsm}
                      onChange={(e) => setEditingProduct({ ...editingProduct, gsm: e.target.value })}
                      placeholder="e.g., 80"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editReorderPoint">Reorder Point</Label>
                  <Input
                    id="editReorderPoint"
                    type="number"
                    value={editingProduct.reorderPoint}
                    onChange={(e) => setEditingProduct({ ...editingProduct, reorderPoint: e.target.value })}
                    placeholder="10"
                  />
                </div>
                <Button onClick={handleEditProduct} className="w-full">
                  Update Product
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}