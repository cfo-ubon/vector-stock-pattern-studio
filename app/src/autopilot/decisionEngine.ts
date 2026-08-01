import type { MarketOpportunity } from '../marketing/domain/marketOpportunity';
import type { DailyMission } from '../marketing/domain/dailyMission';
import type { SeasonalEvent } from '../marketing/domain/seasonalEvent';
import type { PortfolioAsset } from '../catalog/domain/types';
import type { OfflineSnapshotResult } from '../marketing/snapshot/snapshotService';
import type { EvidenceBand } from '../marketing/domain/evidence';
import type { AutopilotMode } from './domain/autopilotMode';
import type { AutopilotConstraints } from './domain/constraints';
import type { DesignPlan, DesignPlanDecision, DesignDecisionSource } from './domain/designPlan';
import { inferCategoryId, isSupportedCategoryId, supportedCategoryIds } from './categoryInference';
import { buildCollectionRolePlan, type AutopilotProductionGoal } from './collectionRolePlanner';
import { parseCustomGoal } from './customGoalParser';

// Build 029, Module 2 — Autonomous Design Decision Engine. Consumes the
// same real Marketing Intelligence / Portfolio data every existing screen
// already reads (no new scoring system, no new data fabrication) and
// resolves it into one frozen `DesignPlan`. Every mode differs only in
// which real evidence it selects first; the "resolve remaining fields"
// step at the bottom is shared by every mode, so a plan built from
// PORTFOLIO_GAP evidence and one built from a real Market Opportunity go
// through identical, auditable field-resolution logic.

export interface DecisionEngineInput {
  mode: AutopilotMode;
  requestedCount: number;
  colorwayCount: number;
  marketplacePreference: string | null;
  productionGoal: AutopilotProductionGoal;
  userInstruction?: string;
  constraints: AutopilotConstraints;
  opportunities: MarketOpportunity[];
  missions: DailyMission[];
  seasonalEvents: SeasonalEvent[];
  portfolioAssets: PortfolioAsset[];
  offline: OfflineSnapshotResult;
  now: number;
}

export interface EvidenceSelection {
  source: DesignDecisionSource;
  opportunity: MarketOpportunity | null;
  mission: DailyMission | null;
  theme: string;
  marketplace: string;
  niche: string;
  confidence: EvidenceBand;
  evidenceRefs: string[];
  offline: boolean;
  note: string;
}

function inferredCategoryOf(text: string): string {
  return inferCategoryId(text).categoryId;
}

function isExcluded(categoryText: string, constraints: AutopilotConstraints): boolean {
  return constraints.excludeCategoryIds.includes(inferredCategoryOf(categoryText));
}

function bestOpportunity(opportunities: MarketOpportunity[], constraints: AutopilotConstraints): MarketOpportunity | null {
  const eligible = opportunities.filter((o) => o.status !== 'ARCHIVED' && !isExcluded(o.theme, constraints));
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => b.score.overall - a.score.overall)[0];
}

/** The two Module 12 "honest, not live" fallback categories — the first
 * one not currently excluded, so even a constrained run still resolves to
 * a real, generator-supported category rather than failing outright. */
function evergreenCategory(constraints: AutopilotConstraints): string {
  const candidates = ['botanical', 'geometric', 'organic'].filter((c) => isSupportedCategoryId(c) && !constraints.excludeCategoryIds.includes(c));
  if (candidates.length > 0) return candidates[0];
  const anyAvailable = supportedCategoryIds().find((c) => !constraints.excludeCategoryIds.includes(c));
  return anyAvailable ?? 'botanical';
}

/** Portfolio Gap evidence — the real category with the FEWEST existing
 * Portfolio assets (using `PortfolioAsset.presetId`, the field the catalog
 * already stores the generator category under), never a fabricated "trend"
 * claim. Ties broken by category list order for determinism. */
/** Exported (Build 030, AI CEO Panel) so Mission Control can show a real
 * "Portfolio Gap" reading for whichever theme/category the Hero Card is
 * about to recommend, using the exact same coverage count the PORTFOLIO_GAP
 * mode itself selects on — never a second, possibly-inconsistent count. */
export function leastCoveredCategory(portfolioAssets: PortfolioAsset[], constraints: AutopilotConstraints): { categoryId: string; count: number } {
  const counts = new Map<string, number>();
  for (const c of supportedCategoryIds()) counts.set(c, 0);
  for (const asset of portfolioAssets) {
    if (asset.presetId && counts.has(asset.presetId)) counts.set(asset.presetId, (counts.get(asset.presetId) ?? 0) + 1);
  }
  const eligible = [...counts.entries()].filter(([id]) => !constraints.excludeCategoryIds.includes(id));
  const pool = eligible.length > 0 ? eligible : [...counts.entries()];
  const [categoryId, count] = pool.sort((a, b) => a[1] - b[1])[0];
  return { categoryId, count };
}

/** Exported (Build 029 UI wiring) so the Autopilot screen can derive the
 * real `marketOpportunityId`/`dailyMissionId` a run's frozen Design Plan
 * was built from — for `AutonomousDesignRun.sourceEvidence` (Module 10's
 * traceability) — without re-implementing this selection logic a second
 * time. Calling this and `buildAutonomousDesignPlan` on the identical
 * input is safe: both are pure and deterministic, so they select the same
 * evidence. */
export function selectEvidence(input: DecisionEngineInput): EvidenceSelection {
  const { mode, constraints, opportunities, missions, seasonalEvents, portfolioAssets, offline, now, userInstruction } = input;

  if (mode === 'CUSTOM_GOAL') {
    const parsed = parseCustomGoal(userInstruction ?? '');
    const opportunity = bestOpportunity(
      opportunities.filter((o) => o.theme.toLowerCase().includes(parsed.theme.toLowerCase()) || o.niche.toLowerCase().includes(parsed.theme.toLowerCase())),
      constraints,
    );
    return {
      source: 'customGoal',
      opportunity,
      mission: null,
      theme: parsed.theme,
      marketplace: parsed.marketplace ?? input.marketplacePreference ?? opportunity?.marketplace ?? 'Etsy',
      niche: opportunity?.niche ?? parsed.theme,
      confidence: opportunity?.score.confidence ?? 'unknown',
      evidenceRefs: opportunity?.evidenceRefs ?? [],
      offline: !opportunity,
      note: `Parsed from the user's own instruction: "${userInstruction}".`,
    };
  }

  if (mode === 'TODAYS_MISSION') {
    const latest = [...missions].sort((a, b) => b.date - a.date)[0];
    if (latest) {
      const opportunity = opportunities.find((o) => o.id === latest.opportunityId) ?? null;
      return {
        source: 'dailyMission',
        opportunity,
        mission: latest,
        theme: latest.theme,
        marketplace: input.marketplacePreference ?? latest.primaryMarketplace,
        niche: latest.niche,
        confidence: latest.confidence,
        evidenceRefs: opportunity?.evidenceRefs ?? [],
        offline: false,
        note: `Today's Mission dated ${new Date(latest.date).toLocaleDateString()}.`,
      };
    }
    // No mission exists yet — fall through to the same evidence a full
    // autopilot run would use, honestly noted as a fallback.
  }

  if (mode === 'SEASONAL_OPPORTUNITY') {
    const upcoming = seasonalEvents.filter((e) => e.expectedDemandWindowTo >= now).sort((a, b) => a.recommendedDesignStartDate - b.recommendedDesignStartDate)[0];
    if (upcoming) {
      return {
        source: 'seasonalCalendar',
        opportunity: null,
        mission: null,
        theme: upcoming.eventName,
        marketplace: input.marketplacePreference ?? 'Etsy',
        niche: upcoming.eventName,
        confidence: 'medium',
        evidenceRefs: [`seasonal:${upcoming.id}`],
        offline: false,
        note: `Seasonal Calendar: "${upcoming.eventName}" — recommended design start ${new Date(upcoming.recommendedDesignStartDate).toLocaleDateString()}.`,
      };
    }
    // No seasonal event upcoming — fall through to evergreen.
  }

  if (mode === 'PORTFOLIO_GAP') {
    const { categoryId, count } = leastCoveredCategory(portfolioAssets, constraints);
    return {
      source: 'portfolioGap',
      opportunity: null,
      mission: null,
      theme: categoryId,
      marketplace: input.marketplacePreference ?? 'Etsy',
      niche: categoryId,
      confidence: 'unknown',
      evidenceRefs: [],
      offline: true,
      note: `Portfolio coverage gap: "${categoryId}" has only ${count} existing Portfolio asset(s) — the fewest of any supported category.`,
    };
  }

  if (mode === 'EVERGREEN_COMMERCIAL') {
    const categoryId = evergreenCategory(constraints);
    return {
      source: 'evergreenDefault',
      opportunity: null,
      mission: null,
      theme: categoryId,
      marketplace: input.marketplacePreference ?? 'Etsy',
      niche: categoryId,
      confidence: 'unknown',
      evidenceRefs: [],
      offline: true,
      note: `Evergreen commercial default — a category with steady year-round demand, not tied to any seasonal window.`,
    };
  }

  // FULL_AUTOPILOT, GUIDED_AUTOPILOT, SELLABLE_COLLECTION, and every
  // fallthrough above: the strongest currently-scored real Market
  // Opportunity.
  const opportunity = bestOpportunity(opportunities, constraints);
  if (opportunity) {
    return {
      source: 'marketOpportunity',
      opportunity,
      mission: null,
      theme: opportunity.theme,
      marketplace: input.marketplacePreference ?? opportunity.marketplace,
      niche: opportunity.niche,
      confidence: opportunity.score.confidence,
      evidenceRefs: opportunity.evidenceRefs,
      offline: offline.classification !== 'SAVED_SNAPSHOT',
      note: `Highest-scoring active Market Opportunity ("${opportunity.title}", ${opportunity.score.overall}/100).`,
    };
  }

  // Honest last resort: no live evidence exists at all.
  const categoryId = evergreenCategory(constraints);
  return {
    source: 'evergreenDefault',
    opportunity: null,
    mission: null,
    theme: categoryId,
    marketplace: input.marketplacePreference ?? 'Etsy',
    niche: categoryId,
    confidence: 'unknown',
    evidenceRefs: [],
    offline: true,
    note: 'No verified Market Opportunity is available — using an evergreen commercial default rather than fabricating market evidence.',
  };
}

function densityFromPreference(preference: AutopilotConstraints['preferredDensity']): number {
  if (preference === 'low') return 0.35;
  if (preference === 'high') return 0.65;
  return 0.5;
}

function th(en: string, thText: string): { rationaleEn: string; rationaleTh: string } {
  return { rationaleEn: en, rationaleTh: thText };
}

/** Builds the full, frozen `DesignPlan` for a run. Pure — no I/O, no
 * randomness beyond what's already baked into `input` — so the same input
 * always produces the same plan (Safety Rule #9's reproducibility applies
 * to the plan itself, not just the generated pixels). */
export function buildAutonomousDesignPlan(input: DecisionEngineInput): DesignPlan {
  const evidence = selectEvidence(input);
  const { constraints } = input;

  const categoryFromTheme = inferCategoryId(evidence.theme);
  const categoryId = constraints.excludeCategoryIds.includes(categoryFromTheme.categoryId) ? evergreenCategory(constraints) : categoryFromTheme.categoryId;

  const marketplace = constraints.preferredMarketplace ?? evidence.marketplace;
  const heroMotif = evidence.mission?.heroMotif ?? null;
  const composition = evidence.mission?.composition ?? null;
  const palette = evidence.mission?.colorDirection ?? [];
  const productTargets = constraints.requiredProductTargets.length > 0 ? constraints.requiredProductTargets : (evidence.mission?.productUseCases ?? []);
  const density = constraints.preferredDensity ? densityFromPreference(constraints.preferredDensity) : (evidence.mission ? undefined : 0.5);

  const { entries: collectionStructure } = buildCollectionRolePlan({ marketplace, productionGoal: input.productionGoal, totalSize: input.requestedCount });

  const decisions: DesignPlanDecision[] = [
    {
      key: 'theme',
      label: 'Theme',
      value: evidence.theme,
      source: evidence.source,
      userLocked: false,
      ...th(`Selected from ${evidence.source === 'marketOpportunity' ? 'the highest-scoring active Market Opportunity' : evidence.note}.`, `ระบบเลือกค่านี้เพราะ ${evidence.note}`),
    },
    {
      key: 'categoryId',
      label: 'Category',
      value: categoryId,
      source: categoryFromTheme.matched ? evidence.source : 'generatorDefault',
      userLocked: false,
      ...th(
        categoryFromTheme.matched
          ? `The theme text matched a real generator category keyword.`
          : `No category keyword matched the theme — defaulted to a broadly commercial category the generator supports.`,
        categoryFromTheme.matched ? `ระบบเลือกค่านี้เพราะข้อความธีมตรงกับหมวดหมู่ที่ระบบรองรับจริง` : `ระบบเลือกค่านี้เพราะไม่มีคำสำคัญตรงกับหมวดหมู่ใด จึงใช้ค่าเริ่มต้นเชิงพาณิชย์`,
      ),
    },
    {
      key: 'marketplace',
      label: 'Target Marketplace',
      value: marketplace,
      source: constraints.preferredMarketplace ? 'userConstraint' : evidence.source,
      userLocked: !!constraints.preferredMarketplace,
      ...th(
        constraints.preferredMarketplace ? 'Locked by your marketplace preference.' : `Taken from the same evidence used for the theme.`,
        constraints.preferredMarketplace ? 'ระบบเลือกค่านี้เพราะคุณล็อกตลาดนี้ไว้' : 'ระบบเลือกค่านี้เพราะใช้หลักฐานเดียวกับที่เลือกธีม',
      ),
    },
    {
      key: 'heroMotif',
      label: 'Hero Motif',
      value: heroMotif ?? 'Not Provided — generator will select a hero motif from the chosen category',
      source: evidence.mission ? 'dailyMission' : 'generatorDefault',
      userLocked: false,
      ...th(
        evidence.mission ? `Taken directly from Today's Mission.` : `No Daily Mission exists for this evidence — the generator's own category default will decide the hero motif.`,
        evidence.mission ? 'ระบบเลือกค่านี้เพราะนำมาจากภารกิจประจำวันโดยตรง' : 'ระบบเลือกค่านี้เพราะไม่มีภารกิจประจำวัน จึงให้ตัวสร้างลวดลายเลือกโมทีฟหลักเอง',
      ),
    },
    {
      key: 'composition',
      label: 'Composition',
      value: composition ?? 'Auto (per collection role)',
      source: evidence.mission ? 'dailyMission' : 'generatorDefault',
      userLocked: false,
      ...th(
        evidence.mission ? `Taken directly from Today's Mission.` : `Each collection role (hero/secondary/blender/...) gets its own real composition — see Collection Structure below.`,
        evidence.mission ? 'ระบบเลือกค่านี้เพราะนำมาจากภารกิจประจำวันโดยตรง' : 'ระบบเลือกค่านี้เพราะแต่ละบทบาทในคอลเลกชันมีโครงสร้างของตัวเอง',
      ),
    },
    {
      key: 'palette',
      label: 'Palette',
      value: palette.length > 0 ? palette.join(', ') : 'Auto (category default palette)',
      source: evidence.mission ? 'dailyMission' : 'generatorDefault',
      userLocked: false,
      ...th(
        palette.length > 0 ? `Color direction taken directly from Today's Mission.` : `No real color-direction evidence exists — the generator's category default palette will be used.`,
        palette.length > 0 ? 'ระบบเลือกค่านี้เพราะทิศทางสีนำมาจากภารกิจประจำวันโดยตรง' : 'ระบบเลือกค่านี้เพราะไม่มีหลักฐานทิศทางสี จึงใช้จานสีเริ่มต้นของหมวดหมู่',
      ),
    },
    {
      key: 'density',
      label: 'Density',
      value: density !== undefined ? String(density) : 'Auto (per collection role)',
      source: constraints.preferredDensity ? 'userConstraint' : 'generatorDefault',
      userLocked: !!constraints.preferredDensity,
      ...th(
        constraints.preferredDensity ? `Locked by your density preference ("${constraints.preferredDensity}").` : `Each collection role sets its own real density.`,
        constraints.preferredDensity ? 'ระบบเลือกค่านี้เพราะคุณล็อกความหนาแน่นไว้' : 'ระบบเลือกค่านี้เพราะแต่ละบทบาทกำหนดความหนาแน่นของตัวเอง',
      ),
    },
    {
      key: 'productTargets',
      label: 'Target Products',
      value: productTargets.length > 0 ? productTargets.join(', ') : 'Not Provided',
      source: constraints.requiredProductTargets.length > 0 ? 'userConstraint' : evidence.mission ? 'dailyMission' : 'generatorDefault',
      userLocked: constraints.requiredProductTargets.length > 0,
      ...th(
        constraints.requiredProductTargets.length > 0
          ? 'Required by your own constraint.'
          : evidence.mission
            ? `Taken directly from Today's Mission's product-use evidence.`
            : 'No product-use evidence is available yet.',
        constraints.requiredProductTargets.length > 0
          ? 'ระบบเลือกค่านี้เพราะคุณกำหนดสินค้าที่ต้องการไว้'
          : evidence.mission
            ? 'ระบบเลือกค่านี้เพราะนำมาจากหลักฐานการใช้งานสินค้าของภารกิจประจำวัน'
            : 'ระบบเลือกค่านี้เพราะยังไม่มีหลักฐานการใช้งานสินค้า',
      ),
    },
  ];

  const risks: DesignPlan['risks'] = [];
  if (evidence.offline) {
    risks.push({ label: 'No live market evidence', detail: 'This plan is built from an offline/fallback evidence source, not a currently-scored Market Opportunity.' });
  }
  if (!categoryFromTheme.matched) {
    risks.push({ label: 'Category inferred, not confirmed', detail: 'The theme text did not clearly match a generator category keyword.' });
  }
  if (evidence.confidence === 'low' || evidence.confidence === 'very-low' || evidence.confidence === 'unknown') {
    risks.push({ label: 'Low evidence confidence', detail: `The underlying evidence's confidence band is "${evidence.confidence}".` });
  }

  return {
    summary: `${input.requestedCount} pattern(s) in the "${categoryId}" category, themed "${evidence.theme}", targeting ${marketplace}.`,
    decisions,
    marketEvidence: evidence.evidenceRefs,
    portfolioReason: input.mode === 'PORTFOLIO_GAP' ? evidence.note : `Not the selection reason for mode "${input.mode}".`,
    targetMarketplace: marketplace,
    targetCustomer: evidence.mission?.buyerGroup ?? 'Not Provided',
    targetProducts: productTargets,
    collectionStructure,
    visualDirection: composition ? `Hero: ${composition}; supporting roles use role-appropriate compositions (see Collection Structure).` : 'Role-appropriate composition per collection item (see Collection Structure).',
    paletteDirection: palette.length > 0 ? palette.join(', ') : `Category default palette for "${categoryId}".`,
    estimatedProductionEffort: `${input.requestedCount} pattern(s) x ${input.colorwayCount} colorway(s), sequential generation with automatic QA.`,
    risks,
    confidence: evidence.confidence,
    dataFreshness: evidence.offline ? (input.offline.snapshot ? input.offline.freshnessLabel : 'No saved Market Snapshot available') : 'Live within this session',
    offline: evidence.offline,
  };
}
