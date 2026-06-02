import { describe, expect, it } from 'vitest';

import {
  PinSchema,
  getShopJewellerId,
  issuePinCookie,
  verifyPinCookie,
  registerPinFailure,
  clearPinFailures,
  isPinLocked,
  PIN_FAILURE_LIMIT,
} from '@luxematch/tenant';
import { hashPin, verifyPin } from '@luxematch/tenant/server';

const SECRET = 'a-test-secret-that-is-at-least-32-chars-long';
const JEWELLER = '00000000-0000-0000-0000-00000000d3e1';

describe('PinSchema', () => {
  it('accepts exactly 6 digits', () => {
    expect(PinSchema.safeParse('123456').success).toBe(true);
  });
  it('rejects non-6-digit input', () => {
    expect(PinSchema.safeParse('12345').success).toBe(false);
    expect(PinSchema.safeParse('1234567').success).toBe(false);
    expect(PinSchema.safeParse('12a456').success).toBe(false);
    expect(PinSchema.safeParse('').success).toBe(false);
  });
});

describe('getShopJewellerId', () => {
  it('returns the id when a valid UUID is set', () => {
    expect(getShopJewellerId({ SHOP_JEWELLER_ID: JEWELLER })).toBe(JEWELLER);
  });
  it('throws when missing', () => {
    expect(() => getShopJewellerId({})).toThrow();
  });
  it('throws when not a UUID', () => {
    expect(() => getShopJewellerId({ SHOP_JEWELLER_ID: 'not-a-uuid' })).toThrow();
  });
});

describe('PIN hashing (scrypt)', () => {
  it('verifies a correct PIN', () => {
    const hash = hashPin('123456');
    expect(verifyPin('123456', hash)).toBe(true);
  });
  it('rejects an incorrect PIN', () => {
    const hash = hashPin('123456');
    expect(verifyPin('000000', hash)).toBe(false);
  });
  it('produces a different hash each time (random salt)', () => {
    expect(hashPin('123456')).not.toBe(hashPin('123456'));
  });
});

describe('PIN cookie (HMAC, Web Crypto)', () => {
  it('round-trips a valid cookie', async () => {
    const cookie = await issuePinCookie(JEWELLER, { secret: SECRET, ttlSeconds: 3600 });
    const result = await verifyPinCookie(cookie.value, { secret: SECRET, ttlSeconds: 3600 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.jewellerId).toBe(JEWELLER);
  });

  it('rejects a tampered cookie', async () => {
    const cookie = await issuePinCookie(JEWELLER, { secret: SECRET, ttlSeconds: 3600 });
    const tampered = cookie.value.slice(0, -3) + 'xyz';
    const result = await verifyPinCookie(tampered, { secret: SECRET, ttlSeconds: 3600 });
    expect(result.valid).toBe(false);
  });

  it('rejects a cookie signed with a different secret', async () => {
    const cookie = await issuePinCookie(JEWELLER, { secret: SECRET, ttlSeconds: 3600 });
    const result = await verifyPinCookie(cookie.value, { secret: 'a-totally-different-secret-32-chars-x', ttlSeconds: 3600 });
    expect(result.valid).toBe(false);
  });

  it('rejects an expired cookie', async () => {
    const cookie = await issuePinCookie(JEWELLER, { secret: SECRET, ttlSeconds: 0 });
    // ttl 0 → immediately expired
    await new Promise((r) => setTimeout(r, 5));
    const result = await verifyPinCookie(cookie.value, { secret: SECRET, ttlSeconds: 0 });
    expect(result.valid).toBe(false);
  });

  it('rejects a missing cookie', async () => {
    const result = await verifyPinCookie(undefined, { secret: SECRET, ttlSeconds: 3600 });
    expect(result.valid).toBe(false);
  });
});

describe('PIN failure rate limiting', () => {
  it('locks after PIN_FAILURE_LIMIT failures', () => {
    const key = `test:${Math.random()}`;
    clearPinFailures(key);
    let locked = false;
    for (let i = 0; i < PIN_FAILURE_LIMIT; i++) {
      locked = registerPinFailure(key).locked;
    }
    expect(locked).toBe(true);
    expect(isPinLocked(key).locked).toBe(true);
    clearPinFailures(key);
    expect(isPinLocked(key).locked).toBe(false);
  });
});
