-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_security_advisor.sql
-- Resolve Supabase Security Advisor warnings:
--   1. RLS Enabled No Policy
--   2. Function Search Path Mutable
--
-- The app reads/writes Supabase through the server-side service-role client.
-- Do not grant broad anon/authenticated table access here; tenancy is enforced
-- in the Hono API and DB helper layer. These explicit service_role policies
-- document that access model and keep direct Data API access denied for anon
-- and authenticated users.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  table_name text;
  table_names text[] := array[
    'analytics_events',
    'branches',
    'brands',
    'cart_items',
    'categories',
    'collections',
    'customer_addresses',
    'customer_otps',
    'customers',
    'inventory_signals',
    'jewellers',
    'order_items',
    'order_status_history',
    'orders',
    'pin_audit_events',
    'product_collections',
    'product_embeddings',
    'product_images',
    'product_sales',
    'product_tryon_assets',
    'product_views',
    'products',
    'search_events',
    'tryon_events'
  ];
begin
  foreach table_name in array table_names loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'service_role_all'
    ) then
      execute format(
        'create policy service_role_all on public.%I for all to service_role using (true) with check (true)',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Lock trigger functions to a deterministic search path. Built-in functions
-- remain available through pg_catalog, and these functions only touch NEW.*.
alter function public.touch_updated_at() set search_path = '';
alter function public.products_set_search_vector() set search_path = '';
