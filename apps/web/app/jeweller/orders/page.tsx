'use client';

import type { JewellerOrderListItem, OrderStatus } from '@luxematch/db';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import JewellerLayout from '@/components/layout/JewellerLayout';

type StatusMeta = { label: string; color: string; icon: React.ReactNode };

const STATUS: Record<string, StatusMeta> = {
  placed:    { label: 'Placed',    color: 'bg-blue-100 text-blue-700',    icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-indigo-100 text-indigo-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  packed:    { label: 'Packed',    color: 'bg-amber-100 text-amber-700',   icon: <Package className="h-3 w-3" /> },
  shipped:   { label: 'Shipped',   color: 'bg-orange-100 text-orange-700', icon: <Truck className="h-3 w-3" /> },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700',       icon: <X className="h-3 w-3" /> },
};

const STATUS_FILTERS: Array<{ value: 'all' | OrderStatus; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'placed',    label: 'Placed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed',    label: 'Packed' },
  { value: 'shipped',   label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatINR(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

export default function JewellerOrdersPage() {
  const [orders, setOrders] = useState<JewellerOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(status: 'all' | OrderStatus) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/shop/orders?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as
        | { data: { orders: JewellerOrderListItem[]; total: number } }
        | { error: { message: string } };
      if ('error' in json) { setError(json.error.message); return; }
      setOrders(json.data.orders);
      setTotal(json.data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(statusFilter); }, [statusFilter]);

  return (
    <JewellerLayout>
      <div className="mx-auto w-full max-w-6xl py-3 sm:py-5 md:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} order{total !== 1 ? 's' : ''} · this shop</p>
        </header>

        {/* Status filter chips */}
        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === f.value
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="overflow-x-auto rounded-2xl border">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-sm text-muted-foreground">
              <Package className="h-6 w-6" />
              {statusFilter !== 'all' ? `No ${statusFilter} orders.` : 'No orders yet.'}
            </div>
          ) : (
            <table className="min-w-[740px] w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Order</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Items</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const st = STATUS[o.status] ?? { label: o.status, color: 'bg-muted text-muted-foreground', icon: null };
                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Link href={`/jeweller/orders/${o.id}`} className="font-semibold tracking-wider text-primary hover:underline">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{o.customer_name ?? '—'}</div>
                        <div className="text-xs">{o.customer_phone ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {o.delivery_type === 'click_and_collect' ? 'Click & Collect' : 'Delivery'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{o.item_count}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatINR(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${st.color}`}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </JewellerLayout>
  );
}
