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

  const ok = services.supabase === 'ok' && services.qdrant === 'ok';
  return c.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      services,
    },
    ok ? 200 : 503,
  );
}
