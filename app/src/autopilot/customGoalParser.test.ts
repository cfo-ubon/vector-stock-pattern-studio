import { describe, it, expect } from 'vitest';
import { parseCustomGoal } from './customGoalParser';

describe('parseCustomGoal', () => {
  it('parses the Thai example sentence from the spec: theme, marketplace, count', () => {
    const result = parseCustomGoal('สร้าง Luxury Botanical สำหรับ Adobe Stock จำนวน 20 ลาย');
    expect(result.marketplace).toBe('Adobe Stock');
    expect(result.count).toBe(20);
    expect(result.theme.toLowerCase()).toContain('luxury');
    expect(result.theme.toLowerCase()).toContain('botanical');
  });

  it('parses an English sentence', () => {
    const result = parseCustomGoal('Create Botanical patterns for Shutterstock, 10 patterns');
    expect(result.marketplace).toBe('Shutterstock');
    expect(result.count).toBe(10);
  });

  it('honestly returns null marketplace/count when neither is present, without fabricating', () => {
    const result = parseCustomGoal('a lovely floral design');
    expect(result.marketplace).toBeNull();
    expect(result.count).toBeNull();
    expect(result.theme.length).toBeGreaterThan(0);
  });

  it('detects a real product-use keyword when present', () => {
    const result = parseCustomGoal('Botanical patterns for gift wrap, 5 designs');
    expect(result.productTargets).toContain('giftWrap');
  });
});
