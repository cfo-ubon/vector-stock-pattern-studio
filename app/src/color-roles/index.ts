import roleDefinitions from './roleDefinitions.json';
import palettes from './palettes.json';

// Color Role System — new in Design Intelligence Core Phase 1. Formalizes
// app/src/trend/designIntelligence.ts's deriveColorRoles() (background/
// primary/secondary/accent picked from a resolved palette's own colors by
// fixed position) as externally-editable data (roleDefinitions.json), plus
// a JSON mirror of the 18 real palettes (palettes.json, ported 1:1 from
// app/src/palettes/palettes.ts — unmodified, still the live source for
// the existing SVG generation; see the Phase 1 report's Phase 2
// recommendations about wiring the two together instead of maintaining
// two copies).

export interface ColorRoleDefinition {
  id: string;
  label: string;
  required: boolean;
  paletteIndex: number;
  description?: string;
}

export interface ColorRoleSystemData {
  schemaVersion: number;
  minPaletteColors: number;
  roles: ColorRoleDefinition[];
}

export interface PaletteData {
  id: string;
  label: string;
  colors: string[];
}

export const COLOR_ROLE_SYSTEM_DATA: ColorRoleSystemData = roleDefinitions as ColorRoleSystemData;

export const PALETTE_DATA: PaletteData[] = palettes as PaletteData[];

export const PALETTE_DATA_BY_ID: Record<string, PaletteData> = Object.fromEntries(
  PALETTE_DATA.map((p) => [p.id, p]),
);

/** Assigns named color roles from a palette's colors using the role
 * system's configured `paletteIndex` per role — the same fixed-position
 * assignment `trend/designIntelligence.ts`'s `deriveColorRoles` already
 * uses, now driven by data instead of a hardcoded index list. Clamps to
 * the last available color if a palette has fewer colors than a role's
 * configured index expects (defensive — every real palette here has 6). */
export function assignColorRoles(colors: string[], system: ColorRoleSystemData = COLOR_ROLE_SYSTEM_DATA): Record<string, string> {
  const result: Record<string, string> = {};
  for (const role of system.roles) {
    const index = Math.min(role.paletteIndex, colors.length - 1);
    result[role.id] = colors[Math.max(0, index)] ?? '#000000';
  }
  return result;
}
