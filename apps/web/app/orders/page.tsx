'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ShoppingBag } from 'lucide-react';
import CustomerLayout from '@/components/layout/CustomerLayout';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/hooks/use-customer';

type Order = {
  id: string; order_number: string; status: string;
  total: number; created_at: string; delivery_type: string;
};

function formatINR(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  placed:    { label: 'Order Placed',  color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed',     color: 'bg-indigo-100 text-indigo-700' },
  packed:    { label: 'Packed',        color: 'bg-amber-100 text-amber-700' },
  shipped:   { label: 'Shipped',       color: 'bg-orange-100 text-orange-700' },
  delivered: { label: 'Delivered',     color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled',     color: 'bg-red-100 text-red-700' },
};

export default function OrdersPage() {
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomer();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!customer) { router.push('/login'); return; }
    fetch('/api/customer/orders', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { data?: { orders: Order[] } }) => { setOrders(j.data?.orders ?? []); })
      .finally(() => setLoading(false));
  }, [customer, authLoading, router]);

  if (loading || authLoading) {
    return <CustomerLayout><div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></CustomerLayout>;
  }

  return (
    <CustomerLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <h1 className="mb-8 text-3xl font-medium tracking-tight">My Orders</h1>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-medium">No orders yet</h2>
            <p className="mt-2 text-muted-foreground">Your orders will appear here after you make a purchase.</p>
            <Link href="/catalog"><Button className="mt-6 rounded-full">Shop Now</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const st = STATUS_LABEL[order.status] ?? { label: order.status, color: 'bg-muted text-muted-foreground' };
              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="font-semibold tracking-wider">{order.order_number}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {' · '}
                          {order.delivery_type === 'click_and_collect' ? 'Click & Collect' : 'Home Delivery'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.color}`}>{st.label}</span>
                        <p className="mt-2 font-semibold text-primary">{formatINR(order.total)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
