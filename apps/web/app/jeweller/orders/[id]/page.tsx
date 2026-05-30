'use client';

import type { OrderStatus, OrderWithItems } from '@luxematch/db';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import JewellerLayout from '@/components/layout/JewellerLayout';
import { Button } from '@/components/ui/button';

const ALL_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  placed:    { label: 'Placed',    color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', color: 'bg-indigo-100 text-indigo-700' },
  packed:    { label: 'Packed',    color: 'bg-amber-100 text-amber-700' },
  shipped:   { label: 'Shipped',   color: 'bg-orange-100 text-orange-700' },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

// Valid transitions: what statuses the jeweller can move an order to from
// the current status. Cancelled orders are terminal; delivered orders too.
const NEXT_STATUSES: Record<string, OrderStatus[]> = {
  placed:    ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed:    ['shipped', 'cancelled'],
  shipped:   ['delivered'],
  delivered: [],
  cancelled: [],
};

function formatINR(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

export default function JewellerOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop/orders/${id}`, { cache: 'no-store' });
      const json = (await res.json()) as
        | { data: OrderWithItems }
        | { error: { message: string } };
      if ('error' in json) { setError(json.error.message); return; }
      setOrder(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function changeStatus(status: OrderStatus) {
    setUpdating(true);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch(`/api/shop/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { error?: { message: string } };
      if (!res.ok) { setError(json.error?.message ?? 'Update failed'); return; }
      setFlash(`Order moved to "${STATUS_LABEL[status]?.label ?? status}"`);
      await load();
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <JewellerLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </JewellerLayout>
    );
  }

  if (!order) {
    return (
      <JewellerLayout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Package className="h-6 w-6" />
          {error ?? 'Order not found.'}
        </div>
      </JewellerLayout>
    );
  }

  const st = STATUS_LABEL[order.status] ?? STATUS_LABEL.placed!;
  const nextStatuses = NEXT_STATUSES[order.status] ?? [];
  const currentIdx = ALL_STATUSES.indexOf(order.status as OrderStatus);
  const isCancelled = order.status === 'cancelled';

  return (
    <JewellerLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <Link href="/jeweller/orders">
          <button className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> All orders
          </button>
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-wider">{order.order_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {order.delivery_type === 'click_and_collect' ? 'Click & Collect' : 'Home Delivery'}
            </p>
          </div>
          <span className={`self-start inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${st.color}`}>
            {st.label}
          </span>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        {flash && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{flash}</div>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {/* Status timeline */}
            {!isCancelled && (
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold">Order Progress</h2>
                <div className="flex items-center gap-0">
                  {ALL_STATUSES.map((s, i) => {
                    const done = i <= currentIdx;
                    const active = i === currentIdx;
                    return (
                      <div key={s} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-1">
                          {done ? (
                            <CheckCircle2 className={`h-5 w-5 ${active ? 'text-primary' : 'text-emerald-500'}`} />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/30" />
                          )}
                          <span className={`text-[10px] font-medium ${done ? (active ? 'text-primary' : 'text-muted-foreground') : 'text-muted-foreground/40'}`}>
                            {STATUS_LABEL[s]?.label}
                          </span>
                        </div>
                        {i < ALL_STATUSES.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < currentIdx ? 'bg-emerald-400' : 'bg-muted'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order items */}
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Items ({order.items.length})</h2>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.product_image_url ? (
                        <Image src={item.product_image_url} alt={item.product_name} fill className="object-cover" unoptimized />
                      ) : <Package className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty {item.quantity} × {formatINR(item.unit_price)}</p>
                    </div>
                    <p className="font-semibold text-sm">{formatINR(item.total_price)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
                {order.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatINR(order.discount)}</span></div>}
                <div className="flex justify-between font-semibold"><span>Total</span><span className="text-primary">{formatINR(order.total)}</span></div>
              </div>
            </div>

            {/* Status history */}
            {order.history.length > 0 && (
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold">Activity</h2>
                <div className="space-y-2">
                  {[...order.history].reverse().map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${STATUS_LABEL[h.status]?.color ?? 'bg-muted'}`}>
                        {STATUS_LABEL[h.status]?.label ?? h.status}
                      </span>
                      <span>{new Date(h.created_at).toLocaleString('en-IN')}</span>
                      {h.note && <span className="italic">{h.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Actions */}
            {nextStatuses.length > 0 && (
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold">Update Status</h2>
                <div className="flex flex-col gap-2">
                  {nextStatuses.map((s) => (
                    <Button
                      key={s}
                      variant={s === 'cancelled' ? 'outline' : 'default'}
                      className={s === 'cancelled' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
                      disabled={updating}
                      onClick={() => void changeStatus(s)}
                    >
                      {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Mark as {STATUS_LABEL[s]?.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery info */}
            {order.delivery_type === 'delivery' && order.shipping_name && (
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4" /> Delivery Address
                </h2>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">{order.shipping_name}</p>
                  {order.shipping_phone && <p>{order.shipping_phone}</p>}
                  {order.shipping_line1 && <p>{order.shipping_line1}</p>}
                  {order.shipping_city && (
                    <p>{[order.shipping_city, order.shipping_state, order.shipping_pin_code].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>
            )}

            {order.delivery_type === 'click_and_collect' && (
              <div className="rounded-2xl border bg-card p-5">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4" /> Click & Collect
                </h2>
                <p className="text-sm text-muted-foreground">Customer will collect from the store.</p>
              </div>
            )}

            {/* Payment info */}
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Payment</h2>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between"><span>Method</span><span className="capitalize">{order.payment_method.replace('dummy_', '')}</span></div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className={order.payment_status === 'paid' ? 'text-emerald-600 font-medium' : ''}>
                    {order.payment_status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </JewellerLayout>
  );
}
