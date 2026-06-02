import { getSupabaseServer } from './client';

export type SearchEventInput = {
  jewellerId: string;
  queryText?: string;
  queryType: 'text' | 'image' | 'hybrid' | 'occasion';
  resultCount: number;
  latencyMs?: number;
  sessionId?: string;
};

/**
 * Fire-and-forget logger. Errors are swallowed because analytics must never
 * impact the user-visible search path.
 */
export async function logSearchEvent(input: SearchEventInput): Promise<void> {
  try {
    const sb = getSupabaseServer();
    await sb.from('search_events').insert({
      jeweller_id: input.jewellerId,
      query_text: input.queryText ?? null,
      query_type: input.queryType,
      result_count: input.resultCount,
      latency_ms: input.latencyMs ?? null,
      session_id: input.sessionId ?? null,
    });
  } catch (err) {
    console.error('[search_events] log failed', err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics events — catch-all stream written by the client trackEvent() lib.
// The allowed event_type list is enforced at the API layer (Zod), so this
// helper just persists whatever it's given. jeweller_id always comes from the
// tenant context, never the client.
// ────────────────────────────────────────────────────────────────────────────

export type AnalyticsEventInput = {
  jewellerId: string;
  eventType: string;
  productId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    const sb = getSupabaseServer();
    await sb.from('analytics_events').insert({
      jeweller_id: input.jewellerId,
      event_type: input.eventType,
      product_id: input.productId ?? null,
      session_id: input.sessionId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.error('[analytics_events] log failed', err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Product views — feeds metrics (top-viewed) and intelligence (interest vs
// conversion). Written when a customer opens a product detail page.
// ────────────────────────────────────────────────────────────────────────────

export type ProductViewInput = {
  jewellerId: string;
  productId: string;
  sessionId?: string | null;
};

export async function logProductView(input: ProductViewInput): Promise<void> {
  try {
    const sb = getSupabaseServer();
    await sb.from('product_views').insert({
      jeweller_id: input.jewellerId,
      product_id: input.productId,
      session_id: input.sessionId ?? null,
    });
  } catch (err) {
    console.error('[product_views] log failed', err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Try-on events — feeds analytics (top try-on products) and intelligence
// (tried-but-not-sold). Written when the AR engine starts tracking a product.
// ────────────────────────────────────────────────────────────────────────────

export type TryonEventInput = {
  jewellerId: string;
  productId?: string | null;
  jewelleryType?: string | null;
  confidence?: number | null;
  deviceType?: string | null;
  sessionId?: string | null;
};

export async function logTryonEvent(input: TryonEventInput): Promise<void> {
  try {
    const sb = getSupabaseServer();
    await sb.from('tryon_events').insert({
      jeweller_id: input.jewellerId,
      product_id: input.productId ?? null,
      jewellery_type: input.jewelleryType ?? null,
      confidence: input.confidence ?? null,
      device_type: input.deviceType ?? null,
      session_id: input.sessionId ?? null,
    });
  } catch (err) {
    console.error('[tryon_events] log failed', err);
  }
}
