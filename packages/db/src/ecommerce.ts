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
