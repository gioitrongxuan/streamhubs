import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderCode } from './order-code.js';

describe('buildOrderCode', () => {
  it('sinh mã theo format {PREFIX}{YYYYMMDDHHmmss}', () => {
    const at = new Date(2026, 5, 4, 14, 49, 45); // 04/06/2026 14:49:45
    assert.equal(buildOrderCode('ME', at), 'ME20260604144945');
  });

  it('pad số nhỏ hơn 10 bằng 0', () => {
    const at = new Date(2026, 0, 2, 3, 4, 5);
    assert.equal(buildOrderCode('MA', at), 'MA20260102030405');
  });
});
