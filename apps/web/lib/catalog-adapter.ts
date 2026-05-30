/**
 * Adapts the API's ProductWithImages shape to the frontend's Product type so
 * all existing components (ProductCard, ProductDetailPanel, ProductGrid) keep
 * working without changes.  The real UUID id is preserved so the cart works.
 */
import type { Category, Occasion, Product } from '@/lib/mock-data';

export type ApiCategory = { id: string; name: string; slug: string | null };

export type ApiImage = {
  id: string;
  url: string;
  alt: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ApiProduct = {
  id: string;
  jeweller_id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  metal: string | null;
  purity: string | null;
  weight_grams: number | null;
  gemstones: string[];
  style_tags: string[];
  occasion_tags: string[];
  price_min: number | null;
  price_max: number | null;
  stock_count: number;
  is_featured: boolean;
  is_active: boolean;
  has_tryon: boolean;
  has_embedding: boolean;
  primary_image_url: string | null;
  images: ApiImage[];
  created_at: string;
};

export function adaptProduct(p: ApiProduct, categories: ApiCategory[]): Product {
  const cat = categories.find(c => c.id === p.category_id);
  const catName = cat?.name ?? 'Jewellery';

  const sortedImages = [...(p.images ?? [])].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.sort_order - b.sort_order;
  });

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: catName as Category,
    description: p.description ?? '',
    price: p.price_min ?? 0,
    originalPrice:
      p.price_max && p.price_max > (p.price_min ?? 0) ? p.price_max : undefined,
    metal: p.metal ?? 'Gold',
    purity: p.purity ?? '',
    weight: p.weight_grams ? `${p.weight_grams}g` : '',
    gemstones: p.gemstones?.length ? p.gemstones.join(', ') : undefined,
    styleTags: p.style_tags ?? [],
    isFeatured: p.is_featured,
    hasTryOn: p.has_tryon,
    jewellerId: p.jeweller_id,
    occasions: (p.occasion_tags ?? []) as Occasion[],
    images: sortedImages.map(img => ({
      id: img.id,
      url: img.url,
      alt: img.alt ?? p.name,
    })),
  };
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  try {
    const res = await fetch('/api/categories', { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: ApiCategory[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchProducts(params?: {
  limit?: number;
  offset?: number;
  featured?: boolean;
  hasTryOn?: boolean;
}): Promise<{ products: ApiProduct[]; total: number }> {
  try {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.featured !== undefined) qs.set('featured', String(params.featured));
    if (params?.hasTryOn !== undefined) qs.set('has_tryon', String(params.hasTryOn));

    const url = `/api/products${qs.size ? `?${qs}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { products: [], total: 0 };
    const json = (await res.json()) as { data?: { products: ApiProduct[]; total: number } };
    return json.data ?? { products: [], total: 0 };
  } catch {
    return { products: [], total: 0 };
  }
}

export async function fetchProductBySlug(slug: string): Promise<ApiProduct | null> {
  try {
    const res = await fetch(`/api/products/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ApiProduct };
    return json.data ?? null;
  } catch {
    return null;
  }
}
