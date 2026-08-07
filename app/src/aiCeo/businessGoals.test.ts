import { describe, it, expect } from 'vitest';
import { createBusinessGoal, detectsRevenueGoal, REVENUE_GOAL_WARNING } from './businessGoals';

describe('detectsRevenueGoal', () => {
  it('flags an English revenue-style goal', () => {
    expect(detectsRevenueGoal('Earn $1000 per month')).toBe(true);
  });
  it('flags a Thai revenue-style goal', () => {
    expect(detectsRevenueGoal('อยากได้รายได้เดือนละ 30000 บาท')).toBe(true);
  });
  it('does not flag a plain quantity/portfolio goal', () => {
    expect(detectsRevenueGoal('Grow the portfolio to 200 patterns')).toBe(false);
  });
});

describe('createBusinessGoal — Core Principle: never convert a revenue target into a guaranteed image count', () => {
  it('a revenue-worded goal is flagged revenueGoalDetected=true, and the caller must show the honesty warning', () => {
    const goal = createBusinessGoal({ type: 'CUSTOM', title: 'Earn $500/month from patterns', now: 1000 });
    expect(goal.revenueGoalDetected).toBe(true);
    expect(REVENUE_GOAL_WARNING).toBe('Revenue cannot be predicted reliably from portfolio size alone.');
  });

  it('a real quantity goal is not falsely flagged as a revenue goal', () => {
    const goal = createBusinessGoal({ type: 'GROW_PORTFOLIO', title: 'Grow to 200 patterns', targetQuantity: 200, now: 1000 });
    expect(goal.revenueGoalDetected).toBe(false);
    expect(goal.targetQuantity).toBe(200);
  });

  it('never fabricates default fields — every optional field is honestly empty/null unless the user supplied it', () => {
    const goal = createBusinessGoal({ type: 'CUSTOM', title: 'My goal', now: 1000 });
    expect(goal.targetDate).toBeNull();
    expect(goal.targetQuantity).toBeNull();
    expect(goal.preferredMarketplaces).toEqual([]);
    expect(goal.status).toBe('ACTIVE');
  });
});
