import { describe, it, expect, beforeEach } from 'vitest';
import { putSubmissionsBulk, loadSubmissions, countSubmissions, clearSubmissionStore } from './submissionStore';
import { createSubmissionRecord } from './submissionRecord';
import { filterSubmissions, searchSubmissions } from './submissionSearchFilter';
import { computeSubmissionStatistics } from './submissionStatistics';
import { getSubmissionQueue } from './submissionQueue';
import { BUILT_IN_MARKETPLACE_PROFILES } from './marketplaceProfile';
import type { SubmissionRecord } from './submissionRecord';

beforeEach(() => {
  localStorage.clear();
});

// Build 015 — "Large dataset" required test category. 2,000 submissions
// spread across all 5 built-in marketplaces and 400 distinct patterns (5
// submissions per pattern, one per marketplace) — large enough to exceed
// any accidental O(n^2) mistake's practical runtime while staying well
// inside typical localStorage quota (each record serializes to well
// under 1KB, so 2,000 records is comfortably a few hundred KB).
describe('Submission Center — large dataset', () => {
  it('persists, filters, searches, and summarizes 2,000 submissions correctly', () => {
    const marketplaceIds = BUILT_IN_MARKETPLACE_PROFILES.map((p) => p.id);
    const patternCount = 400;
    const records: SubmissionRecord[] = [];
    const statuses: SubmissionRecord['status'][] = ['DRAFT', 'READY', 'QUEUED', 'SUBMITTED', 'APPROVED'];

    for (let i = 0; i < patternCount; i++) {
      const patternId = `PATTERN-${i}`;
      marketplaceIds.forEach((marketplaceId, mIndex) => {
        const status = statuses[(i + mIndex) % statuses.length];
        const record = createSubmissionRecord({
          patternId,
          marketplaceId,
          titleSnapshot: `Pattern ${i} for ${marketplaceId}`,
          keywordSnapshot: ['seamless', 'pattern', marketplaceId],
          category: 'Patterns',
          now: 1_700_000_000_000 + i * 1000 + mIndex,
        });
        records.push({ ...record, status });
      });
    }

    expect(records).toHaveLength(patternCount * marketplaceIds.length); // 2,000

    const start = performance.now();
    putSubmissionsBulk(records);
    const writeMs = performance.now() - start;
    expect(writeMs).toBeLessThan(5000);

    expect(countSubmissions()).toBe(2000);
    const loaded = loadSubmissions();
    expect(loaded).toHaveLength(2000);

    // Filter correctness at scale: one marketplace's slice should be
    // exactly patternCount records (one per pattern).
    const etsyOnly = filterSubmissions(loaded, { marketplaceId: 'etsy' });
    expect(etsyOnly).toHaveLength(patternCount);
    expect(etsyOnly.every((r) => r.marketplaceId === 'etsy')).toBe(true);

    // Status filter correctness: every 5th record cycles through the
    // same 5 statuses per pattern, so each status should appear exactly
    // patternCount times across the full 2,000.
    for (const status of statuses) {
      expect(filterSubmissions(loaded, { status })).toHaveLength(patternCount);
    }

    // Search correctness at scale.
    const searchResults = searchSubmissions(loaded, 'Pattern 7 for');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.every((r) => r.titleSnapshot.includes('Pattern 7 for'))).toBe(true);

    // Statistics correctness at scale.
    const stats = computeSubmissionStatistics(loaded);
    expect(stats.totalSubmissions).toBe(2000);
    expect(Object.keys(stats.byMarketplace).sort()).toEqual([...marketplaceIds].sort());
    for (const marketplaceId of marketplaceIds) {
      expect(stats.byMarketplace[marketplaceId].total).toBe(patternCount);
    }
    const statusSum = statuses.reduce((sum, s) => sum + stats.byStatus[s], 0);
    expect(statusSum).toBe(2000);

    // Queue correctness at scale: FIFO ordering must hold even over a
    // large, interleaved dataset.
    const queue = getSubmissionQueue(loaded);
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i].updatedAt).toBeGreaterThanOrEqual(queue[i - 1].updatedAt);
    }

    clearSubmissionStore();
    expect(countSubmissions()).toBe(0);
  }, 30000);
});
