import { describe, it, expect } from 'vitest';
import { listPalettes, getPalette, getColorRoleSystem, resolveColorRolesForPalette, isPaletteCompatible } from './colorRoleService';

describe('colorRoleService', () => {
  it('listPalettes returns all 18 real palettes', () => {
    expect(listPalettes()).toHaveLength(18);
  });

  it('getPalette resolves a real id and returns undefined for an unknown one', () => {
    expect(getPalette('pastel-dream')?.id).toBe('pastel-dream');
    expect(getPalette('not-real')).toBeUndefined();
  });

  it('getColorRoleSystem returns the 4 named roles', () => {
    const system = getColorRoleSystem();
    expect(system.roles.map((r) => r.id).sort()).toEqual(['accent', 'background', 'primary', 'secondary']);
  });

  it('resolveColorRolesForPalette assigns background/primary/secondary/accent by fixed position', () => {
    const palette = getPalette('pastel-dream')!;
    const roles = resolveColorRolesForPalette('pastel-dream')!;
    expect(roles.background).toBe(palette.colors[0]);
    expect(roles.primary).toBe(palette.colors[1]);
    expect(roles.secondary).toBe(palette.colors[2]);
    expect(roles.accent).toBe(palette.colors[3]);
  });

  it('resolveColorRolesForPalette returns undefined for an unknown palette id', () => {
    expect(resolveColorRolesForPalette('not-real')).toBeUndefined();
  });

  it('isPaletteCompatible checks minPaletteColors, false for an unknown palette', () => {
    expect(isPaletteCompatible('pastel-dream')).toBe(true);
    expect(isPaletteCompatible('not-real')).toBe(false);
  });
});
