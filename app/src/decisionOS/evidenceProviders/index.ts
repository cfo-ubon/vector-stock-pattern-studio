import { registerEvidenceProvider } from '../evidenceEngine';
import { portfolioEvidenceProvider } from './portfolioEvidence';
import { collectionEvidenceProvider } from './collectionEvidence';
import { qaEvidenceProvider } from './qaEvidence';
import { commercialEvidenceProvider } from './commercialEvidence';
import { marketplaceEvidenceProvider } from './marketplaceEvidence';
import { businessGoalsEvidenceProvider } from './businessGoalsEvidence';
import { missionEvidenceProvider } from './missionEvidence';
import { pipelineEvidenceProvider } from './pipelineEvidence';
import { exportEvidenceProvider } from './exportEvidence';

// Build 031B, Part 2 — registers all 9 evidence providers named in the
// spec. Idempotent-safe to call more than once (each call simply
// overwrites the same source's registration with itself) since
// `evidenceEngine.ts`'s registry is a plain `Map`.

let registered = false;

export function registerAllEvidenceProviders(): void {
  if (registered) return;
  registerEvidenceProvider('portfolio', portfolioEvidenceProvider);
  registerEvidenceProvider('collection', collectionEvidenceProvider);
  registerEvidenceProvider('qa', qaEvidenceProvider);
  registerEvidenceProvider('commercial', commercialEvidenceProvider);
  registerEvidenceProvider('marketplace', marketplaceEvidenceProvider);
  registerEvidenceProvider('businessGoals', businessGoalsEvidenceProvider);
  registerEvidenceProvider('mission', missionEvidenceProvider);
  registerEvidenceProvider('pipeline', pipelineEvidenceProvider);
  registerEvidenceProvider('export', exportEvidenceProvider);
  registered = true;
}

export function resetEvidenceProviderRegistrationForTest(): void {
  registered = false;
}
