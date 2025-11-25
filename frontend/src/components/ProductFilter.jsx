import React, { useEffect, useState } from "react";
import axios from "axios";
import { Label } from "@/components/ui/label";

export default function ProductFilter({ onChange, initial = {} }) {
  const [productType, setProductType] = useState(initial.productType || "");
  const [sizeFilter, setSizeFilter] = useState(initial.size || "");
  const [gsmFilter, setGsmFilter] = useState(initial.gsm || "");

  const [types, setTypes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [gsms, setGsms] = useState([]);

  // fetch types once (auto-updates when add product triggers re-fetch)
  const fetchTypes = async () => {
    try {
      const res = await axios.get("/api/products/distinct?field=type");
      setTypes(res.data.values || []);
    } catch (e) {
      console.error(e);
    }
  };

  // fetch sizes & gsms; if productType set, filter by it
  const fetchSizesAndGsms = async (type) => {
    try {
      const sizeUrl = type
        ? `/api/products/distinct?field=size&filterField=type&filterValue=${encodeURIComponent(type)}`
        : `/api/products/distinct?field=size`;
      const gsmUrl = type
        ? `/api/products/distinct?field=gsm&filterField=type&filterValue=${encodeURIComponent(type)}`
        : `/api/products/distinct?field=gsm`;

      const [sRes, gRes] = await Promise.all([axios.get(sizeUrl), axios.get(gsmUrl)]);
      setSizes(sRes.data.values || []);
      setGsms(gRes.data.values || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchSizesAndGsms("");
  }, []);

  useEffect(() => {
    // when product type changes, reload sizes/gsm for that type and clear dependent selections
    setSizeFilter("");
    setGsmFilter("");
    fetchSizesAndGsms(productType);
    onChange?.({ productType, size: "", gsm: "" });
  }, [productType]);

  useEffect(() => {
    onChange?.({ productType, size: sizeFilter, gsm: gsmFilter });
  }, [sizeFilter, gsmFilter]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="productType">Product Type</Label>
        <select
          id="productType"
          value={productType}
          onChange={e => setProductType(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sizeFilter">Size</Label>
        <select
          id="sizeFilter"
          value={sizeFilter}
          onChange={e => setSizeFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">All Sizes</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gsmFilter">GSM</Label>
        <select
          id="gsmFilter"
          value={gsmFilter}
          onChange={e => setGsmFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">All GSM</option>
          {gsms.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
    </div>
  );
}
