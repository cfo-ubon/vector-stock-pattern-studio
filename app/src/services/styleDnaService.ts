import { STYLE_DNA_DATA, STYLE_DNA_DATA_BY_ID, type StyleDnaData } from '../style-dna';

// Thin query/lookup service over the Style DNA data library.

export function listStyleDna(): StyleDnaData[] {
  return STYLE_DNA_DATA;
}

export function getStyleDna(id: string): StyleDnaData | undefined {
  return STYLE_DNA_DATA_BY_ID[id];
}

export function findStyleDnaByCategory(categoryId: string): StyleDnaData[] {
  return STYLE_DNA_DATA.filter((dna) => dna.categories.includes(categoryId));
}

export function findStyleDnaByPalette(paletteId: string): StyleDnaData[] {
  return STYLE_DNA_DATA.filter((dna) => dna.paletteIds.includes(paletteId));
}

export function findStyleDnaRecommendedForMarketplace(marketplaceId: string): StyleDnaData[] {
  return STYLE_DNA_DATA.filter((dna) => dna.exportRecommendation.recommendedSites.includes(marketplaceId));
}
