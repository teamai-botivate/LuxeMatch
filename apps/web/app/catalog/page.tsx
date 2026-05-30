'use client';

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, SortAsc } from "lucide-react";
import { motion } from "motion/react";

import CustomerLayout from "@/components/layout/CustomerLayout";
import ProductGrid from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Product } from "@/lib/mock-data";
import { formatINR } from "@/lib/format";
import {
  adaptProduct,
  fetchCategories,
  fetchProducts,
  type ApiCategory,
  type ApiProduct,
} from "@/lib/catalog-adapter";

interface FilterState {
  categories: string[];
  metals: string[];
  priceRange: [number, number];
  occasions: string[];
  hasTryOn: boolean;
}

const defaultFilters: FilterState = {
  categories: [],
  metals: [],
  priceRange: [0, 500000],
  occasions: [],
  hasTryOn: false,
};

const METALS = ["Gold", "White Gold", "Rose Gold", "Silver", "Platinum"];
const OCCASIONS = ["Wedding", "Daily Wear", "Festival", "Anniversary", "Gift"];

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-4 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FiltersPanel({
  filters,
  onChange,
  categoryNames,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  categoryNames: string[];
}) {
  const toggle = (key: "categories" | "metals" | "occasions", val: string) => {
    const arr = filters[key];
    onChange({ ...filters, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] });
  };
  const activeCount =
    filters.categories.length + filters.metals.length + filters.occasions.length +
    (filters.hasTryOn ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 500000 ? 1 : 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <span className="text-sm font-semibold">Filters</span>
        {activeCount > 0 && (
          <button className="text-xs text-primary hover:underline font-medium" onClick={() => onChange(defaultFilters)} data-testid="button-clear-filters">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {categoryNames.length > 0 && (
        <FilterSection title="Category">
          <div className="space-y-2.5">
            {categoryNames.map(c => (
              <label key={c} className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox checked={filters.categories.includes(c)} onCheckedChange={() => toggle("categories", c)} data-testid={`checkbox-${c.toLowerCase()}`} />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      <div className="border-t border-border" />
      <FilterSection title="Metal">
        <div className="space-y-2.5">
          {METALS.map(m => (
            <label key={m} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={filters.metals.includes(m)} onCheckedChange={() => toggle("metals", m)} />
              <span className="text-sm">{m}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <div className="border-t border-border" />
      <FilterSection title="Price Range">
        <div className="space-y-3 px-1">
          <Slider min={0} max={500000} step={5000} value={filters.priceRange} onValueChange={v => onChange({ ...filters, priceRange: v as [number, number] })} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatINR(filters.priceRange[0])}</span>
            <span>{formatINR(filters.priceRange[1])}</span>
          </div>
        </div>
      </FilterSection>

      <div className="border-t border-border" />
      <FilterSection title="Occasion">
        <div className="space-y-2.5">
          {OCCASIONS.map(o => (
            <label key={o} className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={filters.occasions.includes(o)} onCheckedChange={() => toggle("occasions", o)} />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <div className="border-t border-border" />
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium">Virtual Try-On Only</p>
          <p className="text-xs text-muted-foreground">Show AR-enabled items</p>
        </div>
        <Switch checked={filters.hasTryOn} onCheckedChange={v => onChange({ ...filters, hasTryOn: v })} />
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState("relevance");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cats, { products: rawProducts }] = await Promise.all([
        fetchCategories(),
        fetchProducts({ limit: 200 }),
      ]);
      setCategories(cats);
      setProducts(rawProducts.map(p => adaptProduct(p, cats)));
      setLoading(false);
    }
    void load();
  }, []);

  const categoryNames = useMemo(() => [...new Set(products.map(p => p.category))].sort(), [products]);
  const activeFilterCount = filters.categories.length + filters.metals.length + filters.occasions.length + (filters.hasTryOn ? 1 : 0);

  const filtered = useMemo(() => {
    let items = products.filter(p => {
      if (filters.categories.length && !filters.categories.includes(p.category)) return false;
      if (filters.metals.length && !filters.metals.includes(p.metal)) return false;
      if (p.price < filters.priceRange[0] || p.price > filters.priceRange[1]) return false;
      if (filters.occasions.length && !p.occasions.some(o => filters.occasions.includes(o))) return false;
      if (filters.hasTryOn && !p.hasTryOn) return false;
      return true;
    });
    if (sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
    if (sort === "newest") items = [...items].sort((a, b) => b.id.localeCompare(a.id));
    return items;
  }, [products, filters, sort]);

  return (
    <CustomerLayout>
      <div className="min-h-screen pt-16" data-testid="catalog-page">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-12 py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Browse</p>
            <h1 className="text-3xl font-medium tracking-tight">All Jewellery</h1>
          </motion.div>

          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden flex items-center gap-2 rounded-xl" data-testid="button-open-filters">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{activeFilterCount}</span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
                  <SheetHeader className="pb-2"><SheetTitle>Filters</SheetTitle></SheetHeader>
                  <FiltersPanel filters={filters} onChange={setFilters} categoryNames={categoryNames} />
                </SheetContent>
              </Sheet>
              <span className="text-sm text-muted-foreground" data-testid="text-result-count">
                {loading ? "Loading…" : `${filtered.length} Products`}
              </span>
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-44 rounded-xl text-sm" data-testid="select-sort">
                <SortAsc className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-8 items-start">
            <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24 self-start" data-testid="filters-sidebar">
              <FiltersPanel filters={filters} onChange={setFilters} categoryNames={categoryNames} />
            </aside>

            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <ProductGrid products={filtered} />
              )}
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
