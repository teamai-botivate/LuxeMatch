import { logAnalyticsEvent, logProductView, logTryonEvent } from '@luxematch/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { sendData } from './envelope';
import { tenantMiddleware } from './middleware';

type Vars = { Variables: { shopJewellerId: string } };

export const analyticsRoutes = new Hono<Vars>();
analyticsRoutes.use('*', tenantMiddleware);

// Allowed analytics event types. Keep this in sync with the client
// trackEvent() lib. Anything not in this set is rejected at validation so
// the analytics_events table stays queryable.
const EVENT_TYPES = [
  'search_text',
  'search_image',
  'search_hybrid',
  'product_view',
  'tryon_start',
  'tryon_capture',
  'product_saved',
  'product_unsaved',
  'compare_opened',
  'style_quiz_completed',
  'cart_add',
  'order_placed',
] as const;

// ────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/event
//   Body: { event_type, product_id?, session_id?, metadata? }
//   jeweller_id comes from the tenant context, never the body.
//   Always returns 200 (fire-and-forget) so the client never blocks on it.
// ────────────────────────────────────────────────────────────────────────────
const EventBody = z.object({
  event_type: z.enum(EVENT_TYPES),
  product_id: z.string().uuid().optional(),
  session_id: z.string().max(64).optional(),
  metadata: z.record(z.unknown()).optional(),
});

analyticsRoutes.post('/event', zValidator('json', EventBody), async (c) => {
  const jewellerId = c.get('shopJewellerId');
  const body = c.req.valid('json');

  // Route view/tryon events into their dedicated tables too so the existing
  // analytics + intelligence aggregations (which read product_views and
  // tryon_events) light up. The analytics_events row is the audit trail.
  await logAnalyticsEvent({
    jewellerId,
    eventType: body.event_type,
    productId: body.product_id ?? null,
    sessionId: body.session_id ?? null,
    metadata: body.metadata ?? null,
  });

  if (body.event_type === 'product_view' && body.product_id) {
    await logProductView({
      jewellerId,
      productId: body.product_id,
      sessionId: body.session_id ?? null,
    });
  }

  if (body.event_type === 'tryon_start') {
    await logTryonEvent({
      jewellerId,
      productId: body.product_id ?? null,
      jewelleryType: (body.metadata?.jewellery_type as string | undefined) ?? null,
      confidence: (body.metadata?.confidence as number | undefined) ?? null,
      deviceType: (body.metadata?.device_type as string | undefined) ?? null,
      sessionId: body.session_id ?? null,
    });
  }

  return sendData(c, { ok: true });
});
