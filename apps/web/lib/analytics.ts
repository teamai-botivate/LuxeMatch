'use client';

// ────────────────────────────────────────────────────────────────────────────
// Client-side analytics. Fires POST /api/analytics/event with a per-session
// anonymous id. Fully fire-and-forget: never throws, never blocks the UI,
// never awaited by callers. jeweller_id is attached server-side from the
// tenant context — the client never sends it.
// ────────────────────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | 'search_text'
  | 'search_image'
  | 'search_hybrid'
  | 'product_view'
  | 'tryon_start'
  | 'tryon_capture'
  | 'product_saved'
  | 'product_unsaved'
  | 'compare_opened'
  | 'style_quiz_completed'
  | 'cart_add'
  | 'order_placed';

const SESSION_KEY = 'lm_session_id';

/**
 * Stable per-tab session id. Stored in sessionStorage so it resets when the
 * customer walks away (new tab / closed tab) — exactly the kiosk semantics
 * we want. Returns null during SSR.
 */
function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackEvent(
  eventType: AnalyticsEventType,
  props?: { productId?: string; metadata?: Record<string, unknown> },
): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    event_type: eventType,
    product_id: props?.productId,
    session_id: getSessionId() ?? undefined,
    metadata: props?.metadata,
  });

  // Prefer sendBeacon so the request survives navigation (e.g. order_placed
  // fired right before a redirect). Fall back to fetch with keepalive.
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/event', blob);
      return;
    }
  } catch {
    /* fall through to fetch */
  }

  void fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* analytics must never surface errors */
  });
}
