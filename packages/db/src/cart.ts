import { getSupabaseServer } from './client';

export type CartItemWithProduct = {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  added_at: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price_min: number | null;
    price_max: number | null;
    metal: string | null;
    stock_count: number;
    primary_image_url: string | null;
  };
};

export async function getCart(jewellerId: string, customerId: string): Promise<CartItemWithProduct[]> {
  const sb = getSupabaseServer();
  const { data } = await sb
    .from('cart_items')
    .select(`
      id, customer_id, product_id, quantity, added_at,
      product:products (
        id, name, slug, price_min, price_max, metal, stock_count,
        images:product_images ( url, is_primary, sort_order )
      )
    `)
    .eq('jeweller_id', jewellerId)
    .eq('customer_id', customerId)
    .order('added_at', { ascending: false });

  return ((data ?? []) as unknown[]).map((item: unknown) => {
    const i = item as {
      id: string; customer_id: string; product_id: string;
      quantity: number; added_at: string;
      product: {
        id: string; name: string; slug: string;
        price_min: number | null; price_max: number | null;
        metal: string | null; stock_count: number;
        images: Array<{ url: string; is_primary: boolean; sort_order: number }>;
      };
    };
    const imgs = i.product?.images ?? [];
    const primary = imgs.find(x => x.is_primary) ?? imgs.sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: i.id,
      customer_id: i.customer_id,
      product_id: i.product_id,
      quantity: i.quantity,
      added_at: i.added_at,
      product: {
        id: i.product.id,
        name: i.product.name,
        slug: i.product.slug,
        price_min: i.product.price_min,
        price_max: i.product.price_max,
        metal: i.product.metal,
        stock_count: i.product.stock_count,
        primary_image_url: primary?.url ?? null,
      },
    };
  });
}

export async function addToCart(
  jewellerId: string,
  customerId: string,
  productId: string,
  quantity = 1,
): Promise<void> {
  const sb = getSupabaseServer();
  const { data: existing } = await sb
    .from('cart_items')
    .select('id, quantity')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; quantity: number };
    await sb.from('cart_items').update({ quantity: row.quantity + quantity }).eq('id', row.id);
  } else {
    await sb.from('cart_items').insert({
      jeweller_id: jewellerId,
      customer_id: customerId,
      product_id: productId,
      quantity,
    });
  }
}

export async function updateCartItem(
  jewellerId: string,
  customerId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const sb = getSupabaseServer();
  if (quantity <= 0) {
    await sb.from('cart_items').delete()
      .eq('jeweller_id', jewellerId).eq('customer_id', customerId).eq('product_id', productId);
  } else {
    await sb.from('cart_items').update({ quantity })
      .eq('jeweller_id', jewellerId).eq('customer_id', customerId).eq('product_id', productId);
  }
}

export async function removeFromCart(
  jewellerId: string,
  customerId: string,
  productId: string,
): Promise<void> {
  const sb = getSupabaseServer();
  await sb.from('cart_items').delete()
    .eq('jeweller_id', jewellerId).eq('customer_id', customerId).eq('product_id', productId);
}

export async function clearCart(jewellerId: string, customerId: string): Promise<void> {
  const sb = getSupabaseServer();
  await sb.from('cart_items').delete()
    .eq('jeweller_id', jewellerId).eq('customer_id', customerId);
}

export async function getCartCount(jewellerId: string, customerId: string): Promise<number> {
  const sb = getSupabaseServer();
  const { count } = await sb
    .from('cart_items')
    .select('*', { count: 'exact', head: true })
    .eq('jeweller_id', jewellerId)
    .eq('customer_id', customerId);
  return count ?? 0;
}
