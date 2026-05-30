import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import { catalogRoutes } from '@/lib/api/catalog';
import { cloudinaryRoutes } from '@/lib/api/cloudinary';
import { embeddingsRoutes } from '@/lib/api/embeddings';
import { intelligenceRoutes } from '@/lib/api/intelligence';
import { searchRoutes } from '@/lib/api/search';
import { shopRoutes } from '@/lib/api/shop';
import { tryOnAssetRoutes } from '@/lib/api/tryon-assets';
import { authCustomerRoutes } from '@/lib/api/auth-customer';
import { cartRoutes } from '@/lib/api/cart-routes';
import { customerOrderRoutes } from '@/lib/api/customer-orders';

export const runtime = 'nodejs';

type Vars = { Variables: { shopJewellerId: string } };

const app = new Hono<Vars>().basePath('/api');

app.get('/health', (c) =>
  c.json({
    ok: true,
    timestamp: new Date().toISOString(),
  }),
);

app.route('/shop', shopRoutes);
app.route('/cloudinary', cloudinaryRoutes);
app.route('/intelligence', intelligenceRoutes);
app.route('/search', searchRoutes);
app.route('/tryon-assets', tryOnAssetRoutes);
app.route('/embeddings', embeddingsRoutes);
// E-commerce routes
app.route('/customer', authCustomerRoutes);
app.route('/customer/cart', cartRoutes);
app.route('/customer', customerOrderRoutes);
app.route('/', catalogRoutes);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
