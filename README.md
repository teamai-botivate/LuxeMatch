# LuxeMatch — AT Jewellers Platform

An AI-powered jewellery e-commerce platform. Single seller (AT Jewellers), multiple branches, online + in-store experience.

**Full setup and testing guide: [SETUP.md](SETUP.md)**

---

## What it does

- **Customers** browse, search by photo (AI), try jewellery on via AR camera, and buy online
- **Staff** manage inventory, view analytics, and get AI-powered restocking recommendations — all on the same device via a PIN-locked back-office

## Stack

| Concern | Technology |
|---|---|
| Frontend + BFF | Next.js 15 App Router · Hono · TypeScript · Tailwind v4 · shadcn/ui |
| Database | Supabase (Postgres + Realtime) |
| Vector search | Qdrant Cloud · OpenCLIP ViT-B-32 · 512-d cosine |
| AR try-on | MediaPipe `tasks-vision` · Three.js · 2D/3D overlay |
| Image hosting | Cloudinary |
| AI recommendations | Custom demand scoring · velocity signals · seasonal windows |
| Auth | Staff: PIN (scrypt + HMAC cookie) · Customer: phone OTP (demo) |
| Deploy | Vercel (web) · Supabase · Qdrant Cloud · Cloudinary |

## Monorepo layout

```
apps/
  web/            Next.js 15 + Hono BFF  ← the product
  embedder/       Python FastAPI (OpenCLIP inference)

packages/
  ar-engine/      MediaPipe + Three.js AR — 2D and 3D overlay
  cloudinary/     Signed upload contract
  config/         Zod-validated env schema
  db/             Supabase client + all query helpers
  embeddings/     TS client for the OpenCLIP embedder
  intelligence/   Inventory recommendation engine
  qdrant/         Multi-tenant vector search client
  tenant/         PIN cookie (Edge-safe) + shop ID
  types/          Shared Zod schemas and TypeScript types
  ui/             shadcn/ui re-exports

supabase/
  migrations/
    0001_init.sql       Core schema (products, analytics, AR assets)
    0002_ecommerce.sql  E-commerce layer (customers, cart, orders)

scripts/
  provision-shop.ts     First-time device setup
  reindex.ts            Backfill OpenCLIP embeddings into Qdrant
  run-migration.mjs     Seed branches and demo data after migration
```

## Quick start

```bash
pnpm install
pnpm dev
# → http://localhost:3000
```

See [SETUP.md](SETUP.md) for the full setup including database migration, the Python embedder, seeding demo data, and step-by-step test flows.

## Key commands

```bash
pnpm dev                                    # Dev server on :3000
pnpm typecheck                              # TS check across all 11 packages
pnpm build                                  # Production build
pnpm format                                 # Prettier

node scripts/run-migration.mjs              # Seed branches + demo data
pnpm reindex --jeweller-id=<uuid>           # Index products into Qdrant
pnpm provision-shop                         # Set up a new shop device
```

## Architecture decisions

See [`CLAUDE.md`](CLAUDE.md) for the canonical architecture guide — tenancy enforcement, the AR math conventions, the PIN cookie split, and common pitfalls.

## Status

Phases 1–9 complete. Active development:
- Phase 7: Jeweller try-on asset calibration tool
- Phase 10: E-commerce layer (customers, cart, orders, branches) ✓
- Phase 12: Production auth (Supabase Auth, role-based access)
