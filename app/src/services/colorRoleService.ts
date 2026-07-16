import {
  COLOR_ROLE_SYSTEM_DATA,
  PALETTE_DATA,
  PALETTE_DATA_BY_ID,
  assignColorRoles,
  type ColorRoleSystemData,
  type PaletteData,
} from '../color-roles';

// Thin query/lookup service over the Color Role System + Palette data.

export function listPalettes(): PaletteData[] {
  return PALETTE_DATA;
}

export function getPalette(id: string): PaletteData | undefined {
  return PALETTE_DATA_BY_ID[id];
}

export function getColorRoleSystem(): ColorRoleSystemData {
  return COLOR_ROLE_SYSTEM_DATA;
}

/** Resolves a palette id to its named background/primary/secondary/accent
 * color role assignment, using the Color Role System's configured
 * `paletteIndex` per role. Returns undefined for an unknown palette id. */
export function resolveColorRolesForPalette(paletteId: string): Record<string, string> | undefined {
  const palette = PALETTE_DATA_BY_ID[paletteId];
  if (!palette) return undefined;
  return assignColorRoles(palette.colors);
}

export function isPaletteCompatible(paletteId: string): boolean {
  const palette = PALETTE_DATA_BY_ID[paletteId];
  if (!palette) return false;
  return palette.colors.length >= COLOR_ROLE_SYSTEM_DATA.minPaletteColors;
}
