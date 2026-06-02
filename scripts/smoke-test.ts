#!/usr/bin/env tsx
/**
 * smoke-test.ts — verify every external service the platform depends on is
 * reachable and configured correctly.
 *
 * Run with: pnpm smoke-test  (loads apps/web/.env.local)
 * Logs PASS/FAIL per check. Exits 1 if any check fails.
 *
 * Checks:
 *   1. Supabase     — fetch the configured shop jeweller
 *   2. Qdrant       — list collections, verify the products collection exists
 *   3. Embedder     — embed a short test string (OpenCLIP)
 *   4. Cloudinary   — generate a signed upload params object
 *   5. PIN flow     — hash + verify a PIN round-trip (no network)
 */

import { getServerEnv } from '@luxematch/config';
import { getJewellerInternal } from '@luxematch/db';
import { embedText } from '@luxematch/embeddings';
import { getQdrantClient } from '@luxematch/qdrant';
import { generateSignedUploadParams } from '@luxematch/cloudinary';
import { hashPin, verifyPin } from '@luxematch/tenant/server';

type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: 'Supabase — fetch shop jeweller',
    run: async () => {
      const env = getServerEnv();
      const jeweller = await getJewellerInternal(env.SHOP_JEWELLER_ID);
      if (!jeweller) throw new Error('jeweller row not found for SHOP_JEWELLER_ID');
      return `found "${jeweller.store_name}"`;
    },
  },
  {
    name: 'Qdrant — collection exists',
    run: async () => {
      const env = getServerEnv();
      const { collections } = await getQdrantClient().getCollections();
      const names = collections.map((c) => c.name);
      if (!names.includes(env.QDRANT_COLLECTION)) {
        throw new Error(`collection "${env.QDRANT_COLLECTION}" not found (have: ${names.join(', ') || 'none'})`);
      }
      return `"${env.QDRANT_COLLECTION}" present`;
    },
  },
  {
    name: 'Embedder — embed test string',
    run: async () => {
      const vec = await embedText('22k gold polki necklace');
      if (!Array.isArray(vec) || vec.length !== 512) {
        throw new Error(`expected 512-d vector, got ${Array.isArray(vec) ? vec.length : typeof vec}`);
      }
      return '512-d vector returned';
    },
  },
  {
    name: 'Cloudinary — signed upload params',
    run: async () => {
      const env = getServerEnv();
      const params = generateSignedUploadParams({ jewellerId: env.SHOP_JEWELLER_ID, bucket: 'products' });
      if (!params.signature || !params.apiKey) throw new Error('missing signature/apiKey');
      return 'signature generated';
    },
  },
  {
    name: 'PIN — hash + verify round-trip',
    run: async () => {
      const hash = hashPin('123456');
      if (!verifyPin('123456', hash)) throw new Error('verify failed for correct PIN');
      if (verifyPin('000000', hash)) throw new Error('verify passed for wrong PIN');
      return 'scrypt round-trip OK';
    },
  },
];

async function main() {
  console.log('Smoke test\n──────────');
  let failed = 0;
  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`  ✓ ${check.name} — ${detail}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${check.name} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll services reachable.');
}

void main();
