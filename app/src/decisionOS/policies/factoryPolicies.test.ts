import { describe, it, expect } from 'vitest';
import type { DecisionRequestContext, EvidenceBundle, EvidenceRecord } from '../domain/types';
import { FACTORY_POLICIES } from './factoryPolicies';

const NOW = 1_700_000_000_000;

function ctx(requestedAction: string | null = null): DecisionRequestContext {
  return { domain: 'factory', requestedAction, now: NOW, data: {} };
}

function record(id: string, value: unknown): EvidenceRecord {
  return { id, source: 'pipeline', label: id, timestamp: NOW, freshness: 'LIVE', completeness: 1, confidenceImpact: 0.5, missingData: [], value };
}

function bundle(...records: EvidenceRecord[]): EvidenceBundle {
  return { gatheredAt: NOW, records };
}

function policyById(id: string) {
  const p = FACTORY_POLICIES.find((x) => x.id === id);
  if (!p) throw new Error(`policy not found: ${id}`);
  return p;
}

describe('factoryPolicies', () => {
  it('completeExistingWorkFirst applies when a resumable run or un-imported READY item exists', () => {
    const policy = policyById('factory.completeExistingWorkFirst');
    const evidence = bundle(record('pipeline:unfinishedWork', { resumableRunCount: 1, readyNotImportedCount: 0 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('resumeExistingWork');
  });

  it('completeExistingWorkFirst does not apply when there is no unfinished work', () => {
    const policy = policyById('factory.completeExistingWorkFirst');
    const evidence = bundle(record('pipeline:unfinishedWork', { resumableRunCount: 0, readyNotImportedCount: 0 }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(false);
  });

  it('repairBeforeGenerate applies when REVIEW/REJECT items exist', () => {
    const policy = policyById('factory.repairBeforeGenerate');
    const evidence = bundle(record('qa:reviewRejectCounts', { reviewCount: 2, rejectCount: 1, totalEvaluated: 10 }));
    const result = policy.evaluate(evidence, ctx('generate'));
    expect(result.applies).toBe(true);
    expect(result.action).toBe('repairExisting');
    expect(result.warning).toMatch(/repair/i);
  });

  it('qaBeforeExport blocks export when the asset has not passed QA (real evidence-provider value shape: { passed })', () => {
    const policy = policyById('factory.qaBeforeExport');
    const evidence = bundle(record('qa:assetQaStatus', { passed: false }));
    const result = policy.evaluate(evidence, ctx('export'));
    expect(result.applies).toBe(true);
    expect(result.blockedReason).not.toBeNull();
  });

  it('qaBeforeExport allows export when the asset has passed QA', () => {
    const policy = policyById('factory.qaBeforeExport');
    const evidence = bundle(record('qa:assetQaStatus', { passed: true }));
    const result = policy.evaluate(evidence, ctx('export'));
    expect(result.applies).toBe(true);
    expect(result.blockedReason).toBeNull();
  });

  it('qaBeforeExport does not apply for a non-export request', () => {
    const policy = policyById('factory.qaBeforeExport');
    const evidence = bundle(record('qa:assetQaStatus', { passed: false }));
    const result = policy.evaluate(evidence, ctx('generate'));
    expect(result.applies).toBe(false);
  });

  it('seoBeforePackaging recommends finishing SEO when none exists', () => {
    const policy = policyById('factory.seoBeforePackaging');
    const evidence = bundle(record('commercial:seoStatus', { hasSeo: false }));
    const result = policy.evaluate(evidence, ctx());
    expect(result.applies).toBe(true);
    expect(result.action).toBe('finishSeo');
  });

  it('packagingBeforeExport blocks markExportReady until a package has been built', () => {
    const policy = policyById('factory.packagingBeforeExport');
    const evidence = bundle(record('commercial:recentPackage', { found: false, builtAt: null, cooldownMs: 300000 }));
    const result = policy.evaluate(evidence, ctx('markExportReady'));
    expect(result.blockedReason).toMatch(/no commercial package has been built/i);
    expect(result.action).toBe('buildPackage');
  });

  it('packagingBeforeExport does not block once a package exists', () => {
    const policy = policyById('factory.packagingBeforeExport');
    const evidence = bundle(record('commercial:recentPackage', { found: true, builtAt: NOW - 1000, cooldownMs: 300000 }));
    const result = policy.evaluate(evidence, ctx('markExportReady'));
    expect(result.blockedReason).toBeNull();
  });

  it('noDuplicatePackage blocks a rebuild within the cooldown window', () => {
    const policy = policyById('factory.noDuplicatePackage');
    const evidence = bundle(record('commercial:recentPackage', { found: true, builtAt: NOW - 60000, cooldownMs: 300000 }));
    const result = policy.evaluate(evidence, ctx('buildPackage'));
    expect(result.blockedReason).toMatch(/already built/i);
  });

  it('noDuplicatePackage does not block once the cooldown window has passed', () => {
    const policy = policyById('factory.noDuplicatePackage');
    const evidence = bundle(record('commercial:recentPackage', { found: true, builtAt: NOW - 600000, cooldownMs: 300000 }));
    const result = policy.evaluate(evidence, ctx('buildPackage'));
    expect(result.applies).toBe(false);
  });

  it('noIncompleteCollectionExport blocks export when tracked roles are missing', () => {
    const policy = policyById('factory.noIncompleteCollectionExport');
    const evidence = bundle(record('collection:completeness', { collectionId: 'c1', roleTrackingAvailable: true, missingRoles: ['colorway'] }));
    const result = policy.evaluate(evidence, ctx('exportCollection'));
    expect(result.blockedReason).toMatch(/colorway/);
  });

  it('every FACTORY_POLICIES entry declares the 7 Build 031B policies plus the 4 Build 031C dynamic-priority policies', () => {
    expect(FACTORY_POLICIES.map((p) => p.id).sort()).toEqual(
      [
        'factory.completeExistingWorkFirst',
        'factory.repairBeforeGenerate',
        'factory.qaBeforeExport',
        'factory.seoBeforePackaging',
        'factory.packagingBeforeExport',
        'factory.noDuplicatePackage',
        'factory.noIncompleteCollectionExport',
        'factory.prioritizeRepairOnHighReviewRate',
        'factory.prioritizePackagingOnLargeBacklog',
        'factory.prioritizeExportValidationWhenBlocked',
        'factory.prioritizeCollectionCompletionWhenNear',
      ].sort(),
    );
  });
});
