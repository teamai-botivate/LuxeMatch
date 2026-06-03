import { getSupabaseServer } from '@luxematch/db';
import { getQdrantClient } from '@luxematch/qdrant';
import type { Context } from 'hono';

type ServiceStatus = 'ok' | 'error';

/**
 * Health check. Pings the two stateful services we can't run without
 * (Supabase + Qdrant). The embedder is optional at request time (search
 * degrades gracefully) so it's reported but doesn't fail the check.
 *
 * Returns 200 when Supabase + Qdrant are both reachable, 503 otherwise.
 */
export async function healthCheck(c: Context) {
  const services: Record<string, ServiceStatus> = {
    supabase: 'error',
    qdrant: 'error',
  };

  // Supabase: a trivial count query against a tiny global table.
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('categories').select('id', { count: 'exact', head: true });
    services.supabase = error ? 'error' : 'ok';
  } catch {
    services.supabase = 'error';
  }

  // Qdrant: list collections.
  try {
    await getQdrantClient().getCollections();
    services.qdrant = 'ok';
  } catch {
    services.qdrant = 'error';
  }

  // Mask the shop id so health is safe to expose to uptime monitors — first
  // 8 chars are enough to confirm which shop a device is bound to.
  const rawShopId = process.env.SHOP_JEWELLER_ID ?? '';
  const maskedShopId = rawShopId ? `${rawShopId.slice(0, 8)}…` : null;

  const ok = services.supabase === 'ok' && services.qdrant === 'ok';
  return c.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      shop: { id: maskedShopId },
      services,
    },
    ok ? 200 : 503,
  );
}
