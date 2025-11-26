import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useEffect,
  useRef
} from 'react';
import { adaptDashboardFromApi, adaptProductFromApi, adaptPurchaseFromApi, adaptSaleFromApi } from '@/contextAdapters';

const AUTH_STORAGE_KEY = 'psa.auth';

type AuthUser = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role?: string;
};

type PersistedAuth = {
  token: string;
  user: AuthUser;
};

const authStorage = {
  load(): PersistedAuth | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Failed to load auth cache', error);
      return null;
    }
  },
  save(data: PersistedAuth) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist auth cache', error);
    }
  },
  clear() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear auth cache', error);
    }
  }
};

export { authStorage };

export interface Product {
  id: string;
  name: string;
  sku: string; // keeping for backward compatibility, but will use productId in UI
  productId: string; // renamed from sku
  price: number;
  quantity: number;
  reorderPoint: number;
  size: string; // e.g., "10x15 ft", "30x18"
  gsm: string; // e.g., "80", "120"
  image?: string;
  pricePerQuantity?: number; // calculated as sqFt * price
}

export interface Sale {
  id: string;
  date: string;
  customerId?: string;
  customerName?: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  billId?: string;
}

export interface Purchase {
  id: string;
  date: string;
  supplierId?: string;
  supplierName?: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  billId?: string;
}

export interface DashboardSnapshot {
  totalSales: number;
  inventoryValue: number;
  orders: number;
  lowStock: number;
  outOfStock: number;
}

export interface ShopSettings {
  shopName: string;
  shopLogo?: string;
  address?: string;
  contact?: string;
  userName: string;
}

interface ShopState {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  settings: ShopSettings;
  isAuthenticated: boolean;
  authToken: string | null;
  currentUser: AuthUser | null;
  dashboard: DashboardSnapshot;
}

type InventoryUpdateMeta = {
  updateInventory?: boolean;
};


type ShopAction =
  | { type: 'LOGIN'; payload: { userName?: string; token: string; user: AuthUser } }
  | { type: 'LOGOUT' }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_SALES'; payload: Sale[] }
  | { type: 'SET_PURCHASES'; payload: Purchase[] }
  | { type: 'SET_DASHBOARD'; payload: DashboardSnapshot }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'ADD_SALE'; payload: Sale; meta?: InventoryUpdateMeta }
  | { type: 'ADD_PURCHASE'; payload: Purchase; meta?: InventoryUpdateMeta }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<ShopSettings> };

const persistedAuth = authStorage.load();

const initialState: ShopState = {
  products: [],
  sales: [],
  purchases: [],
  settings: {
    shopName: 'Bala Tarpaulins',
    shopLogo: undefined,
    userName: persistedAuth?.user?.name || 'Admin User',
    address: '123 Business Street, City, State 12345',
    contact: '+1 (555) 123-4567'
  },
  isAuthenticated: false,
  authToken: null,
  currentUser: null,
  dashboard: {
    totalSales: 0,
    inventoryValue: 0,
    orders: 0,
    lowStock: 0,
    outOfStock: 0,
  },
};

function shopReducer(state: ShopState, action: ShopAction): ShopState {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        authToken: action.payload.token,
        currentUser: action.payload.user,
        settings: {
          ...state.settings,
          userName: action.payload.userName || action.payload.user?.name || state.settings.userName
        }
      };
    
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, authToken: null, currentUser: null };

    case 'SET_PRODUCTS':
      return {
        ...state,
        products: action.payload,
      };

    case 'SET_SALES':
      return {
        ...state,
        sales: action.payload,
      };

    case 'SET_PURCHASES':
      return {
        ...state,
        purchases: action.payload,
      };

    case 'SET_DASHBOARD':
      return {
        ...state,
        dashboard: action.payload,
      };
    
    case 'ADD_PRODUCT': {
      // Check if product with same productId already exists
      const existingProductIndex = state.products.findIndex(p =>
        p.productId.toLowerCase() === action.payload.productId.toLowerCase()
      );

      if (existingProductIndex !== -1) {
        // Update existing product quantity
        const existingProduct = state.products[existingProductIndex];
        const updatedProduct = {
          ...existingProduct,
          quantity: existingProduct.quantity + action.payload.quantity,
          updatedAt: new Date().toISOString()
        };
        const updatedProducts = [...state.products];
        updatedProducts[existingProductIndex] = updatedProduct;
        return { ...state, products: updatedProducts };
      }

      // Add new product
      return { ...state, products: [...state.products, action.payload] };
    }

    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.payload.id ? action.payload : p)
      };
    
    case 'DELETE_PRODUCT':
      return {
        ...state,
        products: state.products.filter(p => p.id !== action.payload)
      };
    
    case 'ADD_SALE': {
      const shouldUpdateInventory = action.meta?.updateInventory ?? true;

      const products = shouldUpdateInventory
        ? state.products.map(product => {
            const saleProduct = action.payload.products.find(
              sp => sp.productId === product.productId || sp.productId === product.id
            );
            if (saleProduct) {
              return {
                ...product,
                quantity: Math.max(0, product.quantity - saleProduct.quantity),
                price: saleProduct.price ?? product.price,
              };
            }
            return product;
          })
        : state.products;

      return {
        ...state,
        products,
        sales: [action.payload, ...state.sales]
      };
    }

    case 'ADD_PURCHASE': {
      const shouldUpdateInventory = action.meta?.updateInventory ?? true;

      const products = shouldUpdateInventory
        ? state.products.map(product => {
            const purchaseProduct = action.payload.products.find(
              pp => pp.productId === product.productId || pp.productId === product.id
            );
            if (purchaseProduct) {
              return {
                ...product,
                quantity: product.quantity + purchaseProduct.quantity,
                price: purchaseProduct.price ?? product.price
              };
            }
            return product;
          })
        : state.products;

      return {
        ...state,
        products,
        purchases: [action.payload, ...state.purchases]
      };
    }
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      };
    
    default:
      return state;
  }
}

const ShopContext = createContext<{
  state: ShopState;
  dispatch: React.Dispatch<ShopAction>;
} | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(shopReducer, initialState);
  const hasFetchedInitialProductsRef = useRef(false);
  const hasRestoredAuthRef = useRef(false);

  // Restore authentication from localStorage on mount
  useEffect(() => {
    if (hasRestoredAuthRef.current) return;
    hasRestoredAuthRef.current = true;

    const persistedAuth = authStorage.load();
    if (persistedAuth?.token && persistedAuth?.user) {
      dispatch({
        type: 'LOGIN',
        payload: {
          token: persistedAuth.token,
          user: persistedAuth.user,
          userName: persistedAuth.user.name,
        },
      });
    }
  }, []);

  useEffect(() => {
    if (hasFetchedInitialProductsRef.current) return;
    hasFetchedInitialProductsRef.current = true;

    const fetchInitialData = async () => {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://inventory-management-system-xyg3.onrender.com/';
      try {
        // Fetch shop settings from backend
        const settingsResponse = await fetch(`${API_BASE_URL}/api/settings`);
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          dispatch({
            type: 'UPDATE_SETTINGS',
            payload: {
              shopName: settingsData.shopName || 'Bala Tarpaulins',
              address: settingsData.address || '',
              contact: settingsData.contact || '',
              shopLogo: settingsData.shopLogo || undefined,
            },
          });
        }

        const [productsResponse, reportsResponse, dashboardResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/products`),
          fetch(`${API_BASE_URL}/api/reports`),
          fetch(`${API_BASE_URL}/api/dashboard`),
        ]);

        if (!productsResponse.ok) {
          throw new Error(`Failed to load products (status ${productsResponse.status})`);
        }

        const productsPayload = await productsResponse.json();
        if (Array.isArray(productsPayload)) {
          const normalizedProducts = productsPayload.map(adaptProductFromApi);
          dispatch({ type: 'SET_PRODUCTS', payload: normalizedProducts });
        }

        if (reportsResponse.ok) {
          const reportsPayload = await reportsResponse.json();

          if (Array.isArray(reportsPayload?.sales)) {
            const normalizedSales = reportsPayload.sales.map(adaptSaleFromApi);
            dispatch({ type: 'SET_SALES', payload: normalizedSales });
          }

          if (Array.isArray(reportsPayload?.purchases)) {
            const normalizedPurchases = reportsPayload.purchases.map(adaptPurchaseFromApi);
            dispatch({ type: 'SET_PURCHASES', payload: normalizedPurchases });
          }

          if (reportsPayload?.dashboard) {
            const normalizedDashboard = adaptDashboardFromApi(reportsPayload.dashboard);
            dispatch({ type: 'SET_DASHBOARD', payload: normalizedDashboard });
          }
        }

        if (dashboardResponse.ok) {
          const dashboardPayload = await dashboardResponse.json();
          const normalizedDashboard = adaptDashboardFromApi(dashboardPayload);
          dispatch({ type: 'SET_DASHBOARD', payload: normalizedDashboard });
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    void fetchInitialData();
  }, [dispatch]);

  return (
    <ShopContext.Provider value={{ state, dispatch }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}