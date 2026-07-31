// Build 029, Module 4 — Guided Autopilot's compact constraint set. The
// user locks a handful of high-level preferences; the Decision Engine
// resolves every other field automatically around them. Never a full
// re-exposure of the advanced generator UI (spec's own explicit rule).

export interface AutopilotConstraints {
  excludeCategoryIds: string[];
  preferredMarketplace: string | null;
  preferredPaletteFamily: string | null;
  avoidedPaletteFamily: string | null;
  preferredDensity: 'low' | 'medium' | 'high' | null;
  preferredStyle: 'minimal' | 'premium' | 'playful' | null;
  maxQuantity: number | null;
  excludedHeroMotifs: string[];
  requiredProductTargets: string[];
  seasonalPreference: 'require' | 'avoid' | null;
}

export function emptyAutopilotConstraints(): AutopilotConstraints {
  return {
    excludeCategoryIds: [],
    preferredMarketplace: null,
    preferredPaletteFamily: null,
    avoidedPaletteFamily: null,
    preferredDensity: null,
    preferredStyle: null,
    maxQuantity: null,
    excludedHeroMotifs: [],
    requiredProductTargets: [],
    seasonalPreference: null,
  };
}

export interface ConstraintConflict {
  field: string;
  reason: string;
  /** The smallest change that would resolve it — Safety/Module 4's own
   * "propose the smallest necessary change" requirement, never a full
   * reset of every constraint. */
  suggestedResolution: string;
}

/** Real, checkable conflicts only — never a vague "these might not work
 * well together" warning. Each rule below is a genuine impossibility, not
 * a taste judgment. */
export function detectConstraintConflicts(constraints: AutopilotConstraints, availableCategoryIds: string[]): ConstraintConflict[] {
  const conflicts: ConstraintConflict[] = [];

  const remainingCategories = availableCategoryIds.filter((id) => !constraints.excludeCategoryIds.includes(id));
  if (availableCategoryIds.length > 0 && remainingCategories.length === 0) {
    conflicts.push({
      field: 'excludeCategoryIds',
      reason: `Every available category (${availableCategoryIds.join(', ')}) is excluded — no category remains to generate from.`,
      suggestedResolution: `Remove the exclusion on "${constraints.excludeCategoryIds[constraints.excludeCategoryIds.length - 1]}" (the most recently added).`,
    });
  }

  if (constraints.preferredPaletteFamily && constraints.avoidedPaletteFamily && constraints.preferredPaletteFamily === constraints.avoidedPaletteFamily) {
    conflicts.push({
      field: 'preferredPaletteFamily',
      reason: `"${constraints.preferredPaletteFamily}" is set as both the preferred and the avoided palette family.`,
      suggestedResolution: `Clear the "avoid" setting for "${constraints.avoidedPaletteFamily}".`,
    });
  }

  if (constraints.maxQuantity !== null && constraints.maxQuantity <= 0) {
    conflicts.push({
      field: 'maxQuantity',
      reason: 'Maximum production quantity must be a positive number.',
      suggestedResolution: 'Set maximum quantity to at least 1, or clear it to allow Auto.',
    });
  }

  return conflicts;
}
