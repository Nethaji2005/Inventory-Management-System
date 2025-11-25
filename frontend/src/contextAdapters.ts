export interface ApiProduct {
  _id?: string;
  id?: string;
  productId?: string;
  sku?: string;
  name?: string;
  price?: number | string;
  quantity?: number | string;
  reorderPoint?: number | string;
  type?: string;
  size?: string;
  gsm?: string;
  image?: string;
}

export const adaptProductFromApi = (product: ApiProduct) => {
  const fallbackIdSource =
    product?._id ??
    product?.id ??
    product?.productId ??
    product?.sku ??
    product?.name ??
    `temp-${Math.random().toString(36).slice(2)}`;

  const id = String(fallbackIdSource);
  const productId = String(product?.productId ?? product?.sku ?? fallbackIdSource);
  const sku = String(product?.sku ?? productId);

  return {
    id,
    name: product?.name ?? "",
    sku,
    productId,
    price: Number(product?.price ?? 0),
    quantity: Number(product?.quantity ?? 0),
    reorderPoint: Number(product?.reorderPoint ?? 10),
    type: product?.type ?? "",
    size: product?.size ?? "",
    gsm: product?.gsm ?? "",
    image: product?.image ?? undefined,
  };
};

export interface ApiSale {
  _id?: string;
  id?: string;
  billId?: string;
  createdAt?: string;
  date?: string;
  customerName?: string;
  subtotal?: number | string;
  tax?: number | string;
  total?: number | string;
  items?: Array<ApiSaleItem>;
  products?: Array<ApiSaleItem>;
}

export interface ApiSaleItem {
  productId?: string;
  productName?: string;
  quantity?: number | string;
  price?: number | string;
  total?: number | string;
}

export const adaptSaleFromApi = (sale: ApiSale) => {
  const createdAt = sale?.createdAt ?? sale?.date ?? new Date().toISOString();
  const isoDate = new Date(createdAt).toISOString();

  return {
    id: String(sale?._id ?? sale?.id ?? `sale-${Math.random().toString(36).slice(2)}`),
    date: isoDate.split("T")[0],
    customerName: sale?.customerName ?? "",
    subtotal: Number(sale?.subtotal ?? 0),
    tax: Number(sale?.tax ?? 0),
    total: Number(sale?.total ?? 0),
    billId: sale?.billId ?? "",
    products: (sale?.items ?? sale?.products ?? []).map((item) => ({
      productId: String(item?.productId ?? ""),
      productName: item?.productName ?? "",
      quantity: Number(item?.quantity ?? 0),
      price: Number(item?.price ?? 0),
      total: Number(item?.total ?? Number(item?.price ?? 0) * Number(item?.quantity ?? 0)),
    })),
  };
};

export interface ApiPurchase {
  _id?: string;
  id?: string;
  billId?: string;
  createdAt?: string;
  date?: string;
  supplierName?: string;
  supplierId?: string;
  subtotal?: number | string;
  tax?: number | string;
  total?: number | string;
  items?: Array<ApiPurchaseItem>;
  products?: Array<ApiPurchaseItem>;
}

export interface ApiPurchaseItem {
  productId?: string;
  productName?: string;
  quantity?: number | string;
  price?: number | string;
  total?: number | string;
}

export const adaptPurchaseFromApi = (purchase: ApiPurchase) => {
  const createdAt = purchase?.createdAt ?? purchase?.date ?? new Date().toISOString();
  const isoDate = new Date(createdAt).toISOString();

  return {
    id: String(purchase?._id ?? purchase?.id ?? `purchase-${Math.random().toString(36).slice(2)}`),
    date: isoDate.split("T")[0],
    supplierName: purchase?.supplierName ?? "Unknown Supplier",
    supplierId: purchase?.supplierId ? String(purchase.supplierId) : undefined,
    subtotal: Number(purchase?.subtotal ?? 0),
    tax: Number(purchase?.tax ?? 0),
    total: Number(purchase?.total ?? 0),
    billId: purchase?.billId ?? "",
    products: (purchase?.items ?? purchase?.products ?? []).map((item) => ({
      productId: String(item?.productId ?? ""),
      productName: item?.productName ?? "",
      quantity: Number(item?.quantity ?? 0),
      price: Number(item?.price ?? 0),
      total: Number(item?.total ?? Number(item?.price ?? 0) * Number(item?.quantity ?? 0)),
    })),
  };
};

export interface ApiDashboardSnapshot {
  totalSales?: number | string;
  inventoryValue?: number | string;
  orders?: number | string;
  lowStock?: number | string;
  outOfStock?: number | string;
}

export const adaptDashboardFromApi = (snapshot: ApiDashboardSnapshot | null | undefined) => ({
  totalSales: Number(snapshot?.totalSales ?? 0),
  inventoryValue: Number(snapshot?.inventoryValue ?? 0),
  orders: Number(snapshot?.orders ?? 0),
  lowStock: Number(snapshot?.lowStock ?? 0),
  outOfStock: Number(snapshot?.outOfStock ?? 0),
});
