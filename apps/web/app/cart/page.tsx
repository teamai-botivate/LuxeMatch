'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import CustomerLayout from '@/components/layout/CustomerLayout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { useCustomer } from '@/hooks/use-customer';

function formatINR(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

export default function CartPage() {
  const router = useRouter();
  const { customer } = useCustomer();
  const { items, total, loading, updateItem, removeItem } = useCart();

  if (!customer) {
    return (
      <CustomerLayout>
        <div className="flex min-h-screen items-center justify-center px-4 py-20">
          <div className="text-center">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-medium">Please log in</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to view your cart</p>
            <Button className="mt-6 rounded-full" onClick={() => router.push('/login')}>Login / Sign up</Button>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </CustomerLayout>
    );
  }

  if (items.length === 0) {
    return (
      <CustomerLayout>
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-20">
          <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-medium">Your cart is empty</h2>
          <p className="mt-2 text-muted-foreground">Add some beautiful jewellery to get started</p>
          <Link href="/catalog"><Button className="mt-6 rounded-full">Browse Catalog</Button></Link>
        </div>
      </CustomerLayout>
    );
  }

  const savings = 0; // price_max not available in cart snapshot; shown at checkout

  return (
    <CustomerLayout>
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6 lg:px-12">
        <h1 className="mb-8 text-3xl font-medium tracking-tight">Your Cart</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Item list */}
          <div className="space-y-4 lg:col-span-2">
            {items.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.product.primary_image_url ? (
                    <Image src={item.product.primary_image_url} alt={item.product.name} fill className="object-cover" />
                  ) : <div className="h-full w-full bg-muted" />}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/catalog/${item.product.slug}`}>
                        <p className="font-medium hover:text-primary transition-colors">{item.product.name}</p>
                      </Link>
                      {item.product.metal && <p className="text-xs text-muted-foreground">{item.product.metal}</p>}
                    </div>
                    <button onClick={() => void removeItem(item.product_id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full border border-border">
                      <button className="p-1.5 hover:bg-muted rounded-full transition-colors"
                        onClick={() => void updateItem(item.product_id, item.quantity - 1)}
                        disabled={item.quantity <= 1}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button className="p-1.5 hover:bg-muted rounded-full transition-colors"
                        onClick={() => void updateItem(item.product_id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock_count}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-semibold text-primary">{formatINR((item.product.price_min ?? 0) * item.quantity)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Order summary */}
          <div className="rounded-2xl border border-border bg-card p-6 h-fit sticky top-24">
            <h2 className="mb-4 text-base font-semibold">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({items.length} items)</span><span>{formatINR(total)}</span></div>
              {savings > 0 && <div className="flex justify-between text-emerald-600"><span>Savings</span><span>-{formatINR(savings)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-emerald-600">Free</span></div>
              <div className="border-t border-border pt-2 flex justify-between text-base font-semibold">
                <span>Total</span><span className="text-primary">{formatINR(total)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
              💰 Use code <strong>LUXE10</strong> for 10% off at checkout
            </div>
            <Button className="mt-4 w-full rounded-full" onClick={() => router.push('/checkout')}>
              Proceed to Checkout →
            </Button>
            <Link href="/catalog">
              <button className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                Continue Shopping
              </button>
            </Link>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
