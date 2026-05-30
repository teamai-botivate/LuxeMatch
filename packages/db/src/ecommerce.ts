import { getSupabaseServer } from './client';

export type OrderStatus = 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export type OrderRow = {
  id: string;
  jeweller_id: string;
  customer_id: string;
  branch_id: string | null;
  order_number: string;
  status: OrderStatus;
  delivery_type: 'delivery' | 'click_and_collect';
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  payment_id: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_pin_code: string | null;
  notes: string | null;
  estimated_delivery: string | null;
  created_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

export type OrderWithItems = OrderRow & {
  items: OrderItemRow[];
  history: OrderStatusHistoryRow[];
};

export type PlaceOrderInput = {
  jewellerId: string;
  customerId: string;
  branchId?: string;
  deliveryType: 'delivery' | 'click_and_collect';
  items: Array<{
    productId: string;
    productName: string;
    productSlug: string;
    productImageUrl?: string;
    quantity: number;
    unitPrice: number;
  }>;
  discount?: number;
  paymentMethod: string;
  address?: {
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pinCode: string;
  };
  notes?: string;
};

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `ATJ-${ymd}-${rand}`;
}

export async function placeOrder(input: PlaceOrderInput): Promise<OrderRow> {
  const sb = getSupabaseServer();

  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const discount = input.discount ?? 0;
  const total = subtotal - discount;

  const estimated = new Date();
  estimated.setDate(estimated.getDate() + (input.deliveryType === 'click_and_collect' ? 1 : 4));

  const { data: order, error } = await sb
    .from('orders')
    .insert({
      jeweller_id: input.jewellerId,
      customer_id: input.customerId,
      branch_id: input.branchId ?? null,
      order_number: generateOrderNumber(),
      status: 'placed',
      delivery_type: input.deliveryType,
      subtotal,
      discount,
      total,
      payment_method: input.paymentMethod,
      payment_status: 'paid',
      payment_id: `DUMMY_${Date.now()}`,
      shipping_name: input.address?.name ?? null,
      shipping_phone: input.address?.phone ?? null,
      shipping_line1: input.address?.line1 ?? null,
      shipping_line2: input.address?.line2 ?? null,
      shipping_city: input.address?.city ?? null,
      shipping_state: input.address?.state ?? null,
      shipping_pin_code: input.address?.pinCode ?? null,
      notes: input.notes ?? null,
      estimated_delivery: estimated.toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to place order: ${error.message}`);
  const orderRow = order as OrderRow;

  // Insert order items
  const itemRows = input.items.map(i => ({
    order_id: orderRow.id,
    product_id: i.productId,
    product_name: i.productName,
    product_slug: i.productSlug,
    product_image_url: i.productImageUrl ?? null,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    total_price: i.unitPrice * i.quantity,
  }));
  await sb.from('order_items').insert(itemRows);

  // Initial status history entry
  await sb.from('order_status_history').insert({
    order_id: orderRow.id,
    status: 'placed',
    note: 'Order placed successfully.',
  });

  // Auto-confirm after a moment (for demo realism — confirmed immediately)
  await sb.from('orders').update({ status: 'confirmed' }).eq('id', orderRow.id);
  await sb.from('order_status_history').insert({
    order_id: orderRow.id,
    status: 'confirmed',
    note: 'Order confirmed by AT Jewellers.',
    created_at: new Date(Date.now() + 2000).toISOString(),
  });

  return { ...orderRow, status: 'confirmed' };
}

export async function getCustomerOrders(
  jewellerId: string,
  customerId: string,
): Promise<OrderRow[]> {
  const sb = getSupabaseServer();
  const { data } = await sb
    .from('orders')
    .select('*')
    .eq('jeweller_id', jewellerId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  return (data as OrderRow[] | null) ?? [];
}

export async function getOrderWithItems(
  jewellerId: string,
  orderId: string,
): Promise<OrderWithItems | null> {
  const sb = getSupabaseServer();

  const { data: order } = await sb
    .from('orders')
    .select('*')
    .eq('jeweller_id', jewellerId)
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;

  const [{ data: items }, { data: history }] = await Promise.all([
    sb.from('order_items').select('*').eq('order_id', orderId).order('created_at'),
    sb.from('order_status_history').select('*').eq('order_id', orderId).order('created_at'),
  ]);

  return {
    ...(order as OrderRow),
    items: (items as OrderItemRow[] | null) ?? [],
    history: (history as OrderStatusHistoryRow[] | null) ?? [],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Jeweller-side order management (Phase E3)
// ────────────────────────────────────────────────────────────────────────────

export type JewellerOrderListItem = OrderRow & {
  customer_phone: string | null;
  customer_name: string | null;
  item_count: number;
};

export async function listJewellerOrders(
  jewellerId: string,
  opts: {
    status?: OrderStatus | 'all';
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ orders: JewellerOrderListItem[]; total: number }> {
  const sb = getSupabaseServer();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  let q = sb
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('jeweller_id', jewellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== 'all') {
    q = q.eq('status', opts.status);
  }

  const { data: orders, count, error } = await q;
  if (error) throw error;

  if (!orders || orders.length === 0) {
    return { orders: [], total: count ?? 0 };
  }

  // Enrich with customer name/phone and item count in one extra round-trip each.
  const customerIds = [...new Set((orders as OrderRow[]).map((o) => o.customer_id))];
  const orderIds = (orders as OrderRow[]).map((o) => o.id);

  const [{ data: customers }, { data: itemCounts }] = await Promise.all([
    sb.from('customers').select('id, phone, name').in('id', customerIds),
    sb.from('order_items').select('order_id').in('order_id', orderIds),
  ]);

  const customerMap = new Map(
    (customers as { id: string; phone: string | null; name: string | null }[] | null ?? []).map(
      (c) => [c.id, c],
    ),
  );
  const itemCountMap = new Map<string, number>();
  for (const item of (itemCounts as { order_id: string }[] | null ?? [])) {
    itemCountMap.set(item.order_id, (itemCountMap.get(item.order_id) ?? 0) + 1);
  }

  const enriched: JewellerOrderListItem[] = (orders as OrderRow[]).map((o) => ({
    ...o,
    customer_phone: customerMap.get(o.customer_id)?.phone ?? null,
    customer_name: customerMap.get(o.customer_id)?.name ?? null,
    item_count: itemCountMap.get(o.id) ?? 0,
  }));

  return { orders: enriched, total: count ?? enriched.length };
}

export async function updateOrderStatus(
  jewellerId: string,
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<OrderRow | null> {
  const sb = getSupabaseServer();

  // Verify ownership before updating.
  const { data: existing } = await sb
    .from('orders')
    .select('id, status')
    .eq('jeweller_id', jewellerId)
    .eq('id', orderId)
    .maybeSingle();
  if (!existing) return null;

  const { data: updated, error } = await sb
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('*')
    .single();
  if (error) throw error;

  // Append to status history.
  await sb.from('order_status_history').insert({
    order_id: orderId,
    status,
    note: note ?? null,
  });

  return updated as OrderRow;
}

export async function getOrderByNumber(
  jewellerId: string,
  orderNumber: string,
): Promise<OrderWithItems | null> {
  const sb = getSupabaseServer();
  const { data: order } = await sb
    .from('orders')
    .select('*')
    .eq('jeweller_id', jewellerId)
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (!order) return null;
  return getOrderWithItems(jewellerId, (order as OrderRow).id);
}
