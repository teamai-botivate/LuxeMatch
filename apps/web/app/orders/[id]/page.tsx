'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Circle, Clock, MapPin, Package, Truck } from 'lucide-react';
import CustomerLayout from '@/components/layout/CustomerLayout';
import { useCustomer } from '@/hooks/use-customer';

type OrderItem = { id: string; product_name: string; product_slug: string; product_image_url: string | null; quantity: number; unit_price: number; total_price: number };
type StatusHistory = { id: string; status: string; note: string | null; created_at: string };
type Order = { id: string; order_number: string; status: string; total: number; subtotal: number; discount: number; delivery_type: string; estimated_delivery: string | null; payment_method: string; shipping_name: string | null; shipping_line1: string | null; shipping_city: string | null; shipping_state: string | null; shipping_pin_code: string | null; created_at: string; items: OrderItem[]; history: StatusHistory[] };

function formatINR(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

const ALL_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];
const STATUS_ICONS: Record<string, React.ReactNode> = {
  placed: <Package className="h-4 w-4" />, confirmed: <CheckCircle2 className="h-4 w-4" />,
  packed: <Package className="h-4 w-4" />, shipped: <Truck className="h-4 w-4" />,
  delivered: <CheckCircle2 className="h-4 w-4" />,
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomer();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const id = params?.id as string;

  useEffect(() => {
    if (authLoading) return;
    if (!customer) { router.push('/login'); return; }
    fetch(`/api/customer/orders/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { data?: Order }) => setOrder(j.data ?? null))
      .finally(() => setLoading(false));
  }, [id, customer, authLoading, router]);

  if (loading || authLoading) {
    return <CustomerLayout><div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></CustomerLayout>;
  }

  if (!order) {
    return <CustomerLayout><div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Order not found.</p></div></CustomerLayout>;
  }

  const currentIdx = ALL_STATUSES.indexOf(order.status);

  return (
    <CustomerLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <Link href="/orders"><button className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-3.5 w-3.5" /> All Orders</button></Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{order.order_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          {order.estimated_delivery && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Estimated delivery</p>
              <p className="font-semibold">{new Date(order.estimated_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
          )}
        </div>

        {/* Tracking timeline */}
        <section className="mb-6 rounded-2xl border bg-card p-5">
          <h2 className="mb-5 text-sm font-semibold">Order Tracking</h2>
          <div className="relative">
            {ALL_STATUSES.filter(s => s !== 'cancelled').map((s, i) => {
              const done = i <= currentIdx;
              const current = i === currentIdx;
              const historyEntry = order.history.find(h => h.status === s);
              return (
                <div key={s} className="flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 z-10 ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'}`}>
                      {STATUS_ICONS[s] ?? <Circle className="h-4 w-4" />}
                    </div>
                    {i < ALL_STATUSES.length - 2 && <div className={`mt-1 w-0.5 flex-1 ${done ? 'bg-primary' : 'bg-border'}`} style={{ minHeight: 24 }} />}
                  </div>
                  <div className="pb-6">
                    <p className={`text-sm font-medium capitalize ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{s.replace('_', ' ')}</p>
                    {historyEntry?.note && <p className="text-xs text-muted-foreground">{historyEntry.note}</p>}
                    {historyEntry && <p className="text-xs text-muted-foreground">{new Date(historyEntry.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Items */}
        <section className="mb-6 rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Items</h2>
          <div className="space-y-4">
            {order.items.map(item => (
              <div key={item.id} className="flex gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.product_image_url ? <Image src={item.product_image_url} alt={item.product_name} fill className="object-cover" /> : null}
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <div>
                    <Link href={`/catalog/${item.product_slug}`}><p className="text-sm font-medium hover:text-primary transition-colors">{item.product_name}</p></Link>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-primary">{formatINR(item.total_price)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Price + address summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Payment</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatINR(order.discount)}</span></div>}
              <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span className="text-primary">{formatINR(order.total)}</span></div>
              <p className="text-xs text-muted-foreground capitalize">{order.payment_method.replace('dummy_', '')}</p>
            </div>
          </section>

          {order.shipping_name && (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-3.5 w-3.5" /> Delivery Address</h2>
              <div className="text-sm space-y-0.5">
                <p className="font-medium">{order.shipping_name}</p>
                <p className="text-muted-foreground">{order.shipping_line1}</p>
                <p className="text-muted-foreground">{order.shipping_city}, {order.shipping_state} – {order.shipping_pin_code}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
