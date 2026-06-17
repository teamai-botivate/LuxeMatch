/**
 * Vitest global setup. Runs before any test module is imported, so the eager
 * server-env validation in @luxematch/config (which runs at import time) sees a
 * complete, valid environment. Values are placeholders — tests that exercise
 * real services mock them; these only satisfy the zod schema at module load.
 */
process.env.NODE_ENV ??= 'test';
process.env.SHOP_JEWELLER_ID ??= '00000000-0000-0000-0000-00000000d3e1';
process.env.LM_PIN_COOKIE_SECRET ??= 'a-test-secret-that-is-at-least-32-chars-long';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-key';
process.env.CLOUDINARY_API_KEY ??= 'cld-key';
process.env.CLOUDINARY_API_SECRET ??= 'cld-secret';
process.env.CLOUDINARY_CLOUD_NAME ??= 'cld-name';
process.env.QDRANT_URL ??= 'https://example.qdrant.io';
process.env.QDRANT_API_KEY ??= 'qdrant-key';
process.env.EMBEDDER_URL ??= 'https://example.embedder.io';
