# Deployment Guide

How to deploy LuxeMatch to production and provision a shop on a device.

> **Current target: Render + managed cloud services.** A future migration to
> AWS (S3/CloudFront + EC2 + self-hosted Qdrant) is planned but **deferred** —
> the UI/UX is being refined first. Nothing in this guide depends on AWS. When
> the migration happens, only env vars and `packages/cloudinary` change; the
> flow stays identical.

---

## Architecture at a glance

| Component | Service | Notes |
|---|---|---|
| Web app + API (Next.js + Hono) | Render web service `luxematch-web` | one deploy, SSR + BFF |
| OpenCLIP embedder (FastAPI) | Render web service `luxematch-embedder` | `apps/embedder`, CPU |
| Postgres | Supabase | relational data, RLS, Realtime |
| Vector search | Qdrant Cloud | `luxematch_products` collection |
| Media CDN | Cloudinary | per-jeweller folders |

Both Render services are described in [`render.yaml`](../render.yaml) (Blueprint).

---

## One-time cloud setup

### 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_ecommerce.sql`
   - `supabase/migrations/0003_security_advisor.sql`
   - `supabase/seed.sql` (creates the demo jeweller for testing — skip for a
     pure-production project, or delete the demo row afterward)
   - Alternatively: `node scripts/run-migration.mjs` from a machine with the
     service-role key in env.
3. Project Settings → API → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only — never ship to the browser**)
4. Realtime is on by default; the multi-device sync hooks use it.

`0003_security_advisor.sql` resolves Supabase Security Advisor warnings without
opening direct table access: it adds explicit `service_role` policies to every
RLS-enabled app table, and fixes mutable `search_path` on the trigger functions
flagged by the advisor.

### 2. Qdrant Cloud
1. Create a free-tier cluster.
2. Copy the cluster URL → `QDRANT_URL` and an API key → `QDRANT_API_KEY`.
3. The collection is created automatically on first `pnpm reindex`
   (`ensureCollection()` makes `luxematch_products` with the jeweller_id
   payload index). No manual setup needed.

### 3. Cloudinary
1. Create an account; note the **cloud name**.
2. Dashboard → copy API key + secret.
3. Set `CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (same value),
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (**secret is server-only**).
4. Folders (`<jewellerId>/products`, `/tryon`, `/logo`) are created on first
   signed upload — nothing to pre-create.

### 4. Embedder service (Render)
Render Blueprint creates `luxematch-embedder` from `render.yaml`:
- `rootDir: apps/embedder`, `pip install -r requirements.txt`,
  `uvicorn embedder:app`.
- First boot downloads ~350 MB of OpenCLIP weights — the build/cold start is
  slow. **Use the `starter` plan or larger** (free tier's 512 MB RAM is too
  small for torch + the model).
- Set `EMBEDDER_API_KEY` to a random secret. Set the *same* value on the web
  service so it can authenticate.
- Once live, copy the embedder's public URL → web service `EMBEDDER_URL`.

### 5. Web service (Render)
Render Blueprint creates `luxematch-web`:
- Build: `pnpm install --frozen-lockfile && pnpm --filter @luxematch/web build`
- Start: `pnpm --filter @luxematch/web start`
- Health check: `/api/health`
- Set every env var marked `sync: false` in `render.yaml` (see
  [`apps/web/.env.production.example`](../apps/web/.env.production.example) for
  the annotated list).
- Set `ALLOWED_ORIGINS` to the deployed web origin(s), comma-separated, e.g.
  `https://luxematch-web.onrender.com`. `NODE_ENV=production` makes the API
  reject unknown origins.

---

## First-deploy checklist (cloud)

1. ☐ Supabase project created, both migrations + seed run
2. ☐ Qdrant Cloud cluster created, URL + key in hand
3. ☐ Cloudinary account, cloud name + key + secret in hand
4. ☐ Render Blueprint applied (`render.yaml`) → both services created
5. ☐ All `sync: false` env vars set on both Render services
6. ☐ `EMBEDDER_API_KEY` identical on web + embedder
7. ☐ `EMBEDDER_URL` on web points at the live embedder
8. ☐ Deploy. Wait for the embedder to finish downloading model weights.
9. ☐ `curl https://<web>/api/health` → `{ ok: true, services: { supabase: "ok", qdrant: "ok" } }`
10. ☐ `pnpm smoke-test` (locally, env pointed at prod) → all checks pass
11. ☐ Provision the first real shop (below)
12. ☐ Verify that shop's `/catalog` shows only its products

---

## Per-shop install

A shop is one `jewellers` row + a `SHOP_JEWELLER_ID` baked into that device's
environment. For the **shop-kiosk** mode, each device gets its own
`SHOP_JEWELLER_ID`. For the **public e-commerce** mode, the deployment runs
without `SHOP_JEWELLER_ID` (multi-tenant; the jeweller is resolved per request
— see the platform routing layer).

To provision a kiosk device / a new shop:

1. From a machine with the service-role key in `apps/web/.env.local`:
   ```bash
   pnpm provision-shop
   ```
   The interactive script:
   - Prompts for store name, city, owner, phone, and a 6-digit PIN.
   - Creates the `jewellers` row in the shared Supabase.
   - Writes `SHOP_JEWELLER_ID` + a generated `LM_PIN_COOKIE_SECRET` to
     `apps/web/.env.local` (or prints them for you to set in Render).
2. Add the shop's products (jeweller back-office → Products → Add product),
   uploading images and try-on PNGs.
3. Index the new shop's products into Qdrant:
   ```bash
   pnpm reindex --jeweller-id=<new-uuid>
   ```
4. The device is ready. Customers browse; staff unlock `/jeweller/*` with the PIN.

---

## Secrets — never expose to the browser

These are server-only. They must appear **only** in Render env (not in any
`NEXT_PUBLIC_*` var, not in client code):

- `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- `CLOUDINARY_API_SECRET`
- `LM_PIN_COOKIE_SECRET`
- `QDRANT_API_KEY`
- `EMBEDDER_API_KEY`

`packages/config` enforces the server/client split at module load — a missing
required server var throws at startup, and `getServerEnv()` refuses to run in a
client bundle.

---

## Health monitoring

`GET /api/health` returns:
```json
{
  "ok": true,
  "timestamp": "2026-...",
  "shop": { "id": "00000000…" },
  "services": { "supabase": "ok", "qdrant": "ok" }
}
```
- HTTP **200** when Supabase + Qdrant are reachable, **503** otherwise.
- Render's `healthCheckPath` is wired to it, so a degraded deploy won't go live.
- The embedder has its own `/health` (`luxematch-embedder` healthCheckPath).

---

## Rollback

Render keeps previous deploys. To roll back: Render dashboard → the service →
Deploys → pick a known-good deploy → "Redeploy". No data migration is involved
unless a Supabase migration shipped in the bad deploy — migrations are additive
and applied manually, so app rollback alone is safe.
