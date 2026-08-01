import { describe, it, expect } from 'vitest';
import { toNano } from './helpers';

describe('toNano', () => {
  it('converts whole NACKL to nano', () => {
    expect(toNano(1)).toBe('1000000000');
    expect(toNano(0)).toBe('0');
  });

  it('converts fractional NACKL to nano', () => {
    expect(toNano(0.5)).toBe('500000000');
    expect(toNano(1.123456789)).toBe('1123456789');
  });

  it('handles the smallest representable unit', () => {
    expect(toNano(0.000000001)).toBe('1');
  });

  it('floors sub-nano fractions', () => {
    // float math: 0.1 * 1e9 === 100000000.00000001 → floored to 100000000
    expect(toNano(0.1)).toBe('100000000');
  });
});
