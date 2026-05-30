import {
  getOrderWithItems,
  listJewellerOrders,
  updateOrderStatus,
  type OrderStatus,
} from '@luxematch/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { sendData, sendError } from './envelope';
import { pinGuard, tenantMiddleware } from './middleware';

type Vars = { Variables: { shopJewellerId: string } };

export const jewelllerOrderRoutes = new Hono<Vars>();
jewelllerOrderRoutes.use('*', tenantMiddleware);

const StatusEnum = z.enum([
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
]);

// ────────────────────────────────────────────────────────────────────────────
// GET /api/shop/orders  // PIN GUARD
//   Query: status (all|placed|confirmed|packed|shipped|delivered|cancelled)
//          limit, offset
// ────────────────────────────────────────────────────────────────────────────
const ListQuery = z.object({
  status: z.enum(['all', 'placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

jewelllerOrderRoutes.get('/', pinGuard, zValidator('query', ListQuery), async (c) => {
  const jewellerId = c.get('shopJewellerId');
  const q = c.req.valid('query');
  const { orders, total } = await listJewellerOrders(jewellerId, {
    status: q.status as OrderStatus | 'all' | undefined,
    limit: q.limit,
    offset: q.offset,
  });
  return sendData(c, { orders, total });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/shop/orders/:id  // PIN GUARD
// ────────────────────────────────────────────────────────────────────────────
jewelllerOrderRoutes.get('/:id', pinGuard, async (c) => {
  const jewellerId = c.get('shopJewellerId');
  const order = await getOrderWithItems(jewellerId, c.req.param('id'));
  if (!order) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, order);
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/shop/orders/:id  // PIN GUARD
//   Body: { status, note? }
// ────────────────────────────────────────────────────────────────────────────
const PatchBody = z.object({
  status: StatusEnum,
  note: z.string().max(500).optional(),
});

jewelllerOrderRoutes.patch('/:id', pinGuard, zValidator('json', PatchBody), async (c) => {
  const jewellerId = c.get('shopJewellerId');
  const { status, note } = c.req.valid('json');
  const updated = await updateOrderStatus(jewellerId, c.req.param('id'), status, note);
  if (!updated) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, updated);
});
