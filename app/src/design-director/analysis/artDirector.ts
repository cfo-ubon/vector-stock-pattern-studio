import { hexToHsl } from '../../palettes/colorTransform';
import type { CreativeBrief } from '../domain/creativeBrief';
import type { CollectionCompleteness } from './completeness';
import type { CollectionBalance } from './balance';
import type { CollectionDiversity } from './diversity';

// Build 028B — Module 7: AI Art Director pre-generation review. Every
// recommendation here is derived from an already-computed, real signal
// (Completeness/Balance/Diversity's own outputs, or a real HSL lightness
// reading of the brief's own color direction when it's real hex) — nothing
// is invented. Checks that need a real generated tile (hero visibility,
// negative space, layout density) are out of scope for a *plan* review —
// those activate once a Generator Handoff has produced real patterns, and
// this module says so explicitly rather than fabricating a number for them.

const HEX_PATTERN = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/;

export interface ArtDirectorRecommendation {
  id: string;
  message: string;
  why: string;
  severity: 'info' | 'warning' | 'critical';
}

export function computeArtDirectorReview(
  brief: CreativeBrief,
  completeness: CollectionCompleteness,
  balance: CollectionBalance,
  diversity: CollectionDiversity,
): ArtDirectorRecommendation[] {
  const recommendations: ArtDirectorRecommendation[] = [];

  for (const check of completeness.checks) {
    if (!check.passed) {
      recommendations.push({ id: `completeness-${check.id}`, message: check.label, why: check.explanation, severity: 'critical' });
    }
  }

  for (const warning of balance.warnings) {
    recommendations.push({ id: `balance-${recommendations.length}`, message: 'Collection balance is off target', why: warning, severity: 'warning' });
  }

  for (const warning of diversity.warnings) {
    recommendations.push({ id: `diversity-${recommendations.length}`, message: 'Collection lacks variety', why: warning, severity: 'warning' });
  }

  const hexColors = brief.colorDirection.filter((c) => HEX_PATTERN.test(c));
  if (hexColors.length > 0) {
    const avgLightness = hexColors.reduce((sum, c) => sum + hexToHsl(c).l, 0) / hexColors.length;
    if (avgLightness < 30) {
      recommendations.push({
        id: 'palette-too-dark',
        message: 'Palette too dark',
        why: `The brief's color direction averages ${Math.round(avgLightness)}/100 lightness across its ${hexColors.length} hex color(s) — most stock-pattern buyers expect at least one lighter colorway option.`,
        severity: 'warning',
      });
    }
  } else if (brief.colorDirection.length > 0) {
    recommendations.push({
      id: 'palette-not-hex',
      message: 'Palette lightness cannot be checked yet',
      why: `The brief's color direction (${brief.colorDirection.join(', ')}) is research terms, not hex colors — add real hex values (e.g. via the Colorway Strategist) to enable a lightness check.`,
      severity: 'info',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'no-issues',
      message: 'No issues found',
      why: 'Completeness, balance, and diversity checks all passed and no lightness concern was detected.',
      severity: 'info',
    });
  }

  return recommendations;
}
