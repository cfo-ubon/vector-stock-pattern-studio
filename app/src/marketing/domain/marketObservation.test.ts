import { describe, it, expect } from 'vitest';
import {
  createMarketObservation,
  normalizeMarketObservation,
  isValidMarketObservation,
  isValidTrendDirection,
  isValidBuyerIntent,
  InvalidMarketObservationInputError,
} from './marketObservation';

describe('createMarketObservation', () => {
  it('produces a well-shaped observation and requires an explicit evidence status', () => {
    const now = new Date(2026, 6, 18).getTime();
    const obs = createMarketObservation({
      sourceType: 'shutterstock',
      evidenceStatus: 'USER_OBSERVATION',
      sourceTitle: 'Trending: cottagecore florals',
      demandSignal: 'high',
      competitionSignal: 'medium',
      now,
    });
    expect(obs.id).toMatch(/^OBS-\d{8}-[0-9A-Z]{6}$/);
    expect(obs.evidenceStatus).toBe('USER_OBSERVATION');
    expect(obs.demandSignal).toBe('high');
    expect(obs.trendDirection).toBe('unknown');
    expect(isValidMarketObservation(obs)).toBe(true);
  });

  it('rejects a missing/invalid evidenceStatus rather than defaulting it — the non-negotiable provenance rule', () => {
    // @ts-expect-error intentionally invalid input for the runtime guard
    expect(() => createMarketObservation({ sourceType: 'etsy', evidenceStatus: 'looks-real-trust-me' })).toThrow(
      InvalidMarketObservationInputError,
    );
  });

  it('rejects an unknown sourceType', () => {
    // @ts-expect-error intentionally invalid input for the runtime guard
    expect(() => createMarketObservation({ sourceType: 'facebook', evidenceStatus: 'SAMPLE_DATA' })).toThrow(
      InvalidMarketObservationInputError,
    );
  });

  it('never silently upgrades SAMPLE_DATA to a more trustworthy status', () => {
    const obs = createMarketObservation({ sourceType: 'manual-observation', evidenceStatus: 'SAMPLE_DATA' });
    expect(obs.evidenceStatus).toBe('SAMPLE_DATA');
  });
});

describe('isValidTrendDirection / isValidBuyerIntent', () => {
  it('accept the documented bands', () => {
    expect(isValidTrendDirection('rising')).toBe(true);
    expect(isValidTrendDirection('nonsense')).toBe(false);
    expect(isValidBuyerIntent('ready-to-buy')).toBe(true);
    expect(isValidBuyerIntent('nonsense')).toBe(false);
  });
});

describe('normalizeMarketObservation', () => {
  it('fills defaults for a record missing newer optional fields', () => {
    const bare = {
      id: 'OBS-20260101-ABCDEF',
      sourceType: 'pinterest',
      evidenceStatus: 'AI_INFERENCE',
      observationDate: 1000,
      createdAt: 1000,
      schemaVersion: 1,
    } as never;
    const normalized = normalizeMarketObservation(bare);
    expect(normalized.tags).toEqual([]);
    expect(normalized.trendDirection).toBe('unknown');
    expect(normalized.demandSignal).toBe('unknown');
  });
});
