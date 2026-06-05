# Auth Readiness

How LuxeMatch authenticates **today**, and the concrete path to **full
multi-staff auth** when a shop needs more than one back-office login.

This document is written so the migration can happen incrementally without a
rewrite. Nothing here is built yet — it is the agreed-upon plan. The current
PIN flow (Phase 12) was hardened specifically so it can sit *underneath* this
future stack rather than be torn out.

---

## 1. Where we are today

Two independent identity tracks, both cookie-based, both tenant-scoped:

| Track | Cookie | Who | Crypto | TTL |
|-------|--------|-----|--------|-----|
| Jeweller back-office | `lm_pin` | The shop (one shared identity) | scrypt hash in `jewellers.pin_hash`, HMAC-signed cookie | `LM_PIN_COOKIE_TTL_SECONDS` (4h default) |
| Customer | `lm_customer` | A shopper | phone OTP → HMAC-signed cookie | 7 days |

Key properties:

- **One PIN per jeweller.** There is no concept of an individual staff member.
  Everyone in the shop shares the same PIN and is therefore indistinguishable
  in the data. `pin_audit_events` records the *attempt IP*, not *who*.
- **Tenancy is enforced in the application layer**, not by RLS. The server
  connects with the Supabase **service-role key**, which bypasses RLS. Every
  query is filtered by `jeweller_id` taken from `ctx.shopJewellerId`
  (the tenant middleware), never from the request body or query string.
  RLS is *enabled* on every table but has no restrictive policies yet — it is
  a "secure by default" backstop for the anon role and the future staff role.
- **PIN hardening already shipped** (Phase 12):
  - `POST /api/shop/unlock` is rate-limited 5 attempts / 60s per
    `(jeweller_id, IP)` bucket.
  - Every attempt (success + failure) is logged to `pin_audit_events`
    via `logPinAudit()` — fire-and-forget, never blocks the unlock path.
  - Cookie is `HttpOnly`, `SameSite=Strict`, `Secure` in production.
  - `POST /api/shop/lock` clears the cookie; the "Lock shop mode" button in
    `JewellerLayout` calls it then redirects to `/jeweller/unlock`.
  - `apps/web/middleware.ts` re-checks the cookie TTL on every `/jeweller/*`
    request (`verifyPinCookie`) and redirects to `/jeweller/unlock` when it has
    expired — this is the idle-lock.

---

## 2. Future stack — Supabase Auth for staff accounts

**Goal:** one shop, multiple staff members, each with their own login and
their own audit trail. The PIN does **not** go away — it stays as the *fast
in-shop unlock* (a staff member signs in once on the shared device, the PIN
re-locks/unlocks the session between customers). Think of it as two layers:

1. **Identity** (who you are) — Supabase Auth, per staff member, persistent.
2. **Presence** (is the device currently unlocked) — the PIN, fast, shared,
   short-lived.

### Roles

- `owner` — full access, manages staff, billing, settings.
- `manager` — products, orders, analytics, intelligence; no staff/billing.
- `staff` — products, orders; read-only analytics.

(Final role list TBD; keep it small.)

---

## 3. Schema changes

### 3.1 New table: `jeweller_staff`

```sql
create table public.jeweller_staff (
  id           uuid primary key default gen_random_uuid(),
  jeweller_id  uuid not null references public.jewellers(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'staff'
                 check (role in ('owner','manager','staff')),
  created_at   timestamptz not null default now(),
  unique (jeweller_id, user_id)
);

create index jeweller_staff_jeweller_idx on public.jeweller_staff (jeweller_id);
create index jeweller_staff_user_idx     on public.jeweller_staff (user_id);
```

This is the **join table that maps `auth.uid()` → `jeweller_id`** and is the
linchpin of the RLS plan in §4.

### 3.2 `product_sales` gains `sold_by_staff_id`

```sql
alter table public.product_sales
  add column sold_by_staff_id uuid references public.jeweller_staff(id) on delete set null;
```

Nullable so historical rows (recorded under the shared PIN) stay valid. Once
staff auth is live, every new sale is attributed to a person, which unlocks
per-staff performance in the analytics/intelligence layer.

### 3.3 `pin_audit_events` links to the staff member who tried

```sql
alter table public.pin_audit_events
  add column staff_id uuid references public.jeweller_staff(id) on delete set null;
```

Today this table records `jeweller_id`, `attempt_ip`, `success`, `created_at`.
Once a staff member is signed in before entering the PIN, we know *who*
attempted the unlock, not just from where. Nullable for the same
backwards-compatibility reason.

---

## 4. RLS update plan

Once `jeweller_staff` exists, flip the API from "service-role bypasses
everything" to "RLS scopes everything", and have authenticated requests use
the **anon key + the user's JWT** instead of the service-role key. The
canonical predicate for every tenant-scoped table:

```sql
-- The jeweller(s) the current authenticated user belongs to.
create or replace function public.current_jeweller_ids()
returns setof uuid
language sql stable
as $$
  select jeweller_id from public.jeweller_staff where user_id = auth.uid()
$$;

-- Example policy on products (repeat for every table carrying jeweller_id):
create policy products_staff_rw on public.products
  for all
  using      (jeweller_id in (select public.current_jeweller_ids()))
  with check (jeweller_id in (select public.current_jeweller_ids()));
```

Apply the same `jeweller_id in (select current_jeweller_ids())` pattern to:
`product_images`, `product_tryon_assets`, `product_embeddings`,
`product_views`, `product_sales`, `search_events`, `tryon_events`,
`analytics_events`, `inventory_signals`, `pin_audit_events`, plus the
e-commerce tables (`carts`, `orders`, `order_items`, …).

Migration sequencing (no big-bang cutover):

1. Ship `jeweller_staff` + the `current_jeweller_ids()` helper.
2. Backfill: create one `owner` staff row per existing jeweller.
3. Add RLS policies **alongside** the still-running service-role path.
4. Switch authenticated back-office requests to the user-JWT client; keep the
   service-role client only for genuinely cross-tenant/admin jobs (seeding,
   the embedder pipeline, cron).
5. Remove service-role usage from request-scoped handlers.

The customer (`lm_customer`) track is unaffected by staff auth and continues
to resolve the jeweller per-request as it does now.

---

## 5. Routes that gain stricter checks

Every route that today carries `// PIN GUARD` keeps that guard **and**
additionally verifies the authenticated staff member belongs to
`ctx.shopJewellerId` (which the RLS predicate above also enforces at the DB
layer — defence in depth). Same list as today:

- `POST   /api/shop/pin/change`
- `GET    /api/shop/metrics`
- `GET    /api/shop/analytics`
- `GET    /api/shop/settings`
- `PATCH  /api/shop`
- all `/api/products` mutations (create / update / delete / media / sale)
- all jeweller order routes (`listJewellerOrders`, `updateOrderStatus`)

New role-gated routes to add: staff management
(`/api/shop/staff` CRUD — `owner` only).

---

## 6. Client-side dependencies to remove

The back-office currently leans on `localStorage` for display-only data, set
at unlock time. These must move to a server-resolved session once staff auth
lands:

- **`localStorage["luxematch_jeweller"]`** — read by `getJewellerData()` in
  `apps/web/components/layout/JewellerLayout.tsx` to show the store/owner name
  in the sidebar. Replace with the authenticated session (the staff member's
  name + their shop), fetched server-side. It is display-only today and not a
  security boundary, but it should not be the source of truth once we have
  real identities.

There are no client components that mutate Supabase directly and no server
secrets in `NEXT_PUBLIC_*` vars (verified in the Phase 12 audit) — so this
list is intentionally short.

---

## 7. Middleware hook points

`apps/web/middleware.ts` (matcher `['/jeweller/:path*']`) is where staff auth
slots in:

1. **Today:** the only public jeweller route is `/jeweller/unlock`; everything
   else requires a valid `lm_pin` cookie (`verifyPinCookie`), else redirect to
   `/jeweller/unlock`.
2. **With staff auth:** add a *first* check for a valid Supabase session
   before the PIN check. Order becomes:
   - No Supabase session → redirect to `/jeweller/login` (new).
   - Session but no/expired `lm_pin` → redirect to `/jeweller/unlock`
     (the fast re-lock — unchanged).
   - Both present → allow.
3. The `lm_pin` layer stays exactly as built; we only prepend the identity
   gate. This keeps the idle-lock UX (PIN re-prompt between customers) intact
   while adding persistent per-staff identity underneath.

---

## 8. What is explicitly *out of scope*

- AWS migration (S3 + CloudFront, EC2, GPU embedder) — deferred until
  explicitly scheduled. None of the above assumes a specific host.
- SSO / SAML — not needed for single-shop staff lists.
- Changing the customer OTP flow.
