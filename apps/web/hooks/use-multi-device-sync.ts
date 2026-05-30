'use client';

import { useEffect, useRef } from 'react';

import { getSupabaseBrowser } from '@/lib/supabase-browser';

export type SyncEvent =
  | { type: 'product_changed'; productId: string }
  | { type: 'sale_recorded'; productId: string }
  | { type: 'tryon_started'; productId: string; jewelleryType: string };

/**
 * Cross-device sync via Supabase Realtime.
 *
 * Subscribes to three DB event streams scoped to this jeweller:
 *   - product INSERT/UPDATE/DELETE  → 'product_changed'
 *   - product_sales INSERT          → 'sale_recorded'
 *   - tryon_events INSERT           → 'tryon_started'
 *
 * When staff updates inventory on one device, the customer-facing catalog on
 * every other device receives a 'product_changed' event and can refetch.
 * The staff dashboard receives 'sale_recorded' and 'tryon_started' events so
 * activity metrics update without a manual page refresh.
 *
 * Pass a stable `onEvent` (useCallback / module-level fn) or the hook
 * uses an internal ref to avoid stale-closure issues with inline functions.
 */
export function useMultiDeviceSync(
  jewellerId: string | null,
  onEvent: (event: SyncEvent) => void,
): void {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!jewellerId) return;

    const sb = getSupabaseBrowser();

    const productChannel = sb
      .channel(`sync-products:${jewellerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `jeweller_id=eq.${jewellerId}` },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newRow = payload.new as { id?: string } | undefined;
          const oldRow = payload.old as { id?: string } | undefined;
          cbRef.current({
            type: 'product_changed',
            productId: newRow?.id ?? oldRow?.id ?? '',
          });
        },
      )
      .subscribe();

    const salesChannel = sb
      .channel(`sync-sales:${jewellerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'product_sales', filter: `jeweller_id=eq.${jewellerId}` },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { product_id?: string } | undefined;
          cbRef.current({ type: 'sale_recorded', productId: row?.product_id ?? '' });
        },
      )
      .subscribe();

    const tryonChannel = sb
      .channel(`sync-tryon:${jewellerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tryon_events', filter: `jeweller_id=eq.${jewellerId}` },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { product_id?: string; jewellery_type?: string } | undefined;
          cbRef.current({
            type: 'tryon_started',
            productId: row?.product_id ?? '',
            jewelleryType: row?.jewellery_type ?? '',
          });
        },
      )
      .subscribe();

    return () => {
      void Promise.all([
        sb.removeChannel(productChannel),
        sb.removeChannel(salesChannel),
        sb.removeChannel(tryonChannel),
      ]);
    };
  }, [jewellerId]);
}
