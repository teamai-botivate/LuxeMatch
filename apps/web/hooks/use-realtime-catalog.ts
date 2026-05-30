'use client';

import { useEffect, useRef } from 'react';

import { getSupabaseBrowser } from '@/lib/supabase-browser';

/**
 * Subscribe to Supabase Realtime for product table changes scoped to a single
 * jeweller. Calls `onUpdate` whenever a product is inserted, updated, or
 * deleted — use it to refetch catalog data so customers see changes without
 * a manual refresh.
 *
 * The callback ref is kept stable so callers can pass an inline function
 * without triggering a resubscribe on every render.
 */
export function useRealtimeCatalog(
  jewellerId: string | null,
  onUpdate: () => void,
): void {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!jewellerId) return;

    const sb = getSupabaseBrowser();
    const channel = sb
      .channel(`catalog:${jewellerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `jeweller_id=eq.${jewellerId}`,
        },
        () => cbRef.current(),
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [jewellerId]);
}
