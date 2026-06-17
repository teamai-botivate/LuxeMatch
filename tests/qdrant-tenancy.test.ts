/**
 * Tenancy guard for vector search. The single most important invariant in the
 * platform: every Qdrant query must carry the jeweller_id must-filter so a
 * customer at shop A can never get shop B's products from an ANN query.
 *
 * buildSearchMustFilter() is the pure function searchByVector() uses to assemble
 * the must-filter, so we test it directly — no client, no network, no mocks.
 */
import { describe, expect, it } from 'vitest';

// Required server env is set in tests/setup-env.ts (a setupFile) so
// @luxematch/config's import-time validation passes before this import resolves.
import { buildSearchMustFilter } from '@luxematch/qdrant';

const JEWELLER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

type Cond = { key: string; match?: { value?: unknown; any?: unknown }; range?: unknown };

describe('buildSearchMustFilter tenancy', () => {
  it('injects jeweller_id as the first must condition (bare filter)', () => {
    const must = buildSearchMustFilter({ jewellerId: JEWELLER }) as Cond[];
    expect(must[0]).toEqual({ key: 'jeweller_id', match: { value: JEWELLER } });
  });

  it('keeps exactly one jeweller_id condition when other filters are supplied', () => {
    const must = buildSearchMustFilter({
      jewellerId: JEWELLER,
      metal: 'gold',
      hasTryOn: true,
      occasionTags: ['wedding'],
      priceMin: 1000,
      priceMax: 50000,
    }) as Cond[];
    const jewellerConds = must.filter((m) => m.key === 'jeweller_id');
    expect(jewellerConds).toHaveLength(1);
    expect(jewellerConds[0]!.match).toEqual({ value: JEWELLER });
    // The extra filters are also present — proves jeweller_id isn't replacing them.
    expect(must.some((m) => m.key === 'metal')).toBe(true);
    expect(must.some((m) => m.key === 'has_tryon')).toBe(true);
  });

  it('uses the exact jeweller id the caller passed (no cross-tenant leak)', () => {
    const must = buildSearchMustFilter({ jewellerId: OTHER }) as Cond[];
    expect(must.some((m) => m.key === 'jeweller_id' && m.match?.value === JEWELLER)).toBe(false);
    expect(must.some((m) => m.key === 'jeweller_id' && m.match?.value === OTHER)).toBe(true);
  });
});
