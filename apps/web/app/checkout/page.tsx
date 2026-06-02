'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, CreditCard, IndianRupee, MapPin, Package, Smartphone, Truck } from 'lucide-react';
import CustomerLayout from '@/components/layout/CustomerLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/use-cart';
import { useCustomer } from '@/hooks/use-customer';
import { trackEvent } from '@/lib/analytics';

function formatINR(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

type PayMethod = 'dummy_card' | 'dummy_upi' | 'dummy_cod';

export default function CheckoutPage() {
  const router = useRouter();
  const { customer } = useCustomer();
  const { items, total } = useCart();
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'click_and_collect'>('delivery');
  const [payMethod, setPayMethod] = useState<PayMethod>('dummy_card');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [address, setAddress] = useState({ name: customer?.name ?? '', phone: '', line1: '', line2: '', city: '', state: '', pin_code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discountAmt = discountApplied ? Math.round(total * 0.1) : 0;
  const finalTotal = total - discountAmt;

  function applyCode() {
    if (discountCode.trim().toUpperCase() === 'LUXE10') setDiscountApplied(true);
    else setError('Invalid discount code');
  }

  async function placeOrder() {
    if (!customer) { router.push('/login'); return; }
    if (items.length === 0) { setError('Cart is empty'); return; }
    if (deliveryType === 'delivery' && !address.line1.trim()) { setError('Please enter delivery address'); return; }

    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/customer/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_type: deliveryType,
          payment_method: payMethod,
          discount_code: discountApplied ? 'LUXE10' : undefined,
          address: deliveryType === 'delivery' ? address : undefined,
          save_address: true,
        }),
      });
      const json = (await res.json()) as { data?: { orderNumber: string; orderId: string }; error?: { message: string } };
      if (!res.ok || json.error) { setError(json.error?.message ?? 'Checkout failed'); return; }
      trackEvent('order_placed', {
        metadata: {
          order_number: json.data!.orderNumber,
          total: finalTotal,
          delivery_type: deliveryType,
          item_count: items.length,
        },
      });
      router.push(`/checkout/success?order=${json.data!.orderNumber}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!customer) {
    return (
      <CustomerLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center"><p className="text-muted-foreground">Please login to checkout.</p>
            <Button className="mt-4 rounded-full" onClick={() => router.push('/login')}>Login</Button></div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="mx-auto max-w-5xl px-4 py-24 md:px-6">
        <h1 className="mb-8 text-3xl font-medium tracking-tight">Checkout</h1>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left: forms */}
          <div className="space-y-6 lg:col-span-3">
            {/* Delivery type */}
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4" /> Delivery Method</h2>
              <div className="grid grid-cols-2 gap-3">
                {(['delivery', 'click_and_collect'] as const).map(type => (
                  <button key={type} onClick={() => setDeliveryType(type)}
                    className={`rounded-xl border p-3 text-left text-sm transition-all ${deliveryType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <div className="font-medium">{type === 'delivery' ? '🚚 Home Delivery' : '🏪 Click & Collect'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{type === 'delivery' ? '3-5 business days · Free' : 'Ready in 1 day · Free'}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Address */}
            {deliveryType === 'delivery' && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" /> Delivery Address</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Full name" value={address.name} onChange={e => setAddress(a => ({ ...a, name: e.target.value }))} className="rounded-xl" />
                  <Input placeholder="Phone" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} className="rounded-xl" />
                  <Input placeholder="Address line 1" value={address.line1} onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))} className="rounded-xl col-span-2" />
                  <Input placeholder="Address line 2 (optional)" value={address.line2} onChange={e => setAddress(a => ({ ...a, line2: e.target.value }))} className="rounded-xl col-span-2" />
                  <Input placeholder="City" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} className="rounded-xl" />
                  <Input placeholder="State" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} className="rounded-xl" />
                  <Input placeholder="PIN code" value={address.pin_code} onChange={e => setAddress(a => ({ ...a, pin_code: e.target.value }))} className="rounded-xl" maxLength={6} />
                </div>
              </section>
            )}

            {/* Payment */}
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4" /> Payment Method</h2>
              <div className="space-y-2">
                {([
                  { id: 'dummy_card' as PayMethod, label: '💳 Debit / Credit Card', sub: 'Visa, Mastercard, RuPay' },
                  { id: 'dummy_upi' as PayMethod, label: '📱 UPI', sub: 'GPay, PhonePe, Paytm' },
                  { id: 'dummy_cod' as PayMethod, label: '💵 Cash on Delivery', sub: 'Pay when you receive' },
                ]).map(p => (
                  <button key={p.id} onClick={() => setPayMethod(p.id)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${payMethod === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.sub}</div>
                  </button>
                ))}
              </div>

              {payMethod === 'dummy_card' && (
                <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Demo card (any values work)</p>
                  <Input placeholder="Card number: 4111 1111 1111 1111" className="rounded-xl text-sm" disabled />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="MM/YY: 12/28" className="rounded-xl text-sm" disabled />
                    <Input placeholder="CVV: 123" className="rounded-xl text-sm" disabled />
                  </div>
                </div>
              )}
              {payMethod === 'dummy_upi' && (
                <div className="mt-4 rounded-xl bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Demo UPI</p>
                  <Input placeholder="demo@upi" className="mt-2 rounded-xl text-sm" disabled />
                </div>
              )}
            </section>
          </div>

          {/* Right: summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-2xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {items.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[160px]">{i.product.name} × {i.quantity}</span>
                    <span className="font-medium">{formatINR((i.product.price_min ?? 0) * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Discount code" value={discountCode}
                  onChange={e => setDiscountCode(e.target.value)}
                  className="rounded-xl text-sm" disabled={discountApplied} />
                <Button variant="outline" size="sm" className="rounded-xl whitespace-nowrap" onClick={applyCode} disabled={discountApplied}>
                  {discountApplied ? '✓ Applied' : 'Apply'}
                </Button>
              </div>
              <div className="space-y-2 text-sm border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(total)}</span></div>
                {discountApplied && <div className="flex justify-between text-emerald-600"><span>Discount (LUXE10)</span><span>-{formatINR(discountAmt)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-emerald-600">Free</span></div>
                <div className="flex justify-between font-semibold text-base border-t pt-2">
                  <span>Total</span><span className="text-primary">{formatINR(finalTotal)}</span>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <Button className="mt-4 w-full rounded-full" onClick={() => void placeOrder()} disabled={loading || items.length === 0}>
                <IndianRupee className="mr-1.5 h-4 w-4" />
                {loading ? 'Placing order…' : `Pay ${formatINR(finalTotal)}`}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">🔒 Secure demo payment — no real transaction</p>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
