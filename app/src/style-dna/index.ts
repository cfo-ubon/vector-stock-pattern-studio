import editorialBotanical from './editorialBotanical.json';
import luxuryFloral from './luxuryFloral.json';
import scandinavianOrganic from './scandinavianOrganic.json';
import minimalBotanical from './minimalBotanical.json';
import vintageHerbarium from './vintageHerbarium.json';
import darkBotanical from './darkBotanical.json';
import modernTropical from './modernTropical.json';
import boutiquePackaging from './boutiquePackaging.json';
import luxuryWallpaper from './luxuryWallpaper.json';
import premiumTextile from './premiumTextile.json';
import kidsPlayful from './kidsPlayful.json';
import retroOrganic from './retroOrganic.json';
import organicAbstract from './organicAbstract.json';
import bohoFloral from './bohoFloral.json';
import softWatercolorInspired from './softWatercolorInspired.json';

// Style DNA Library data loader — Design Intelligence Core Phase 1's
// "no hardcoded" requirement: every one of the 15 built-in identities is
// real editable JSON, ported 1:1 from app/src/engine/styleDna.ts's
// STYLE_DNA_PRESETS (unmodified — still the live source for the existing
// SVG generation/Trend Studio; see the Phase 1 report's Phase 2
// recommendations for wiring these two together).

export interface StyleDnaData {
  id: string;
  label: string;
  description: string;
  categories: string[];
  layouts: string[];
  hierarchyPreset: string;
  density: number;
  negativeSpace: number;
  overlapMode: string;
  overlapAmount: number;
  flowProfile: string;
  rhythmProfile: string;
  clusterStyle: string;
  clusterDensity: number;
  motifComplexity: string;
  botanicalGrowthPreset?: string;
  colorStrategy: string;
  paletteIds: string[];
  backgroundStrategy: string;
  svgDepthMode: string;
  exportRecommendation: { tileSize: number; patternScale: number; recommendedSites: string[] };
}

export const STYLE_DNA_DATA: StyleDnaData[] = [
  editorialBotanical,
  luxuryFloral,
  scandinavianOrganic,
  minimalBotanical,
  vintageHerbarium,
  darkBotanical,
  modernTropical,
  boutiquePackaging,
  luxuryWallpaper,
  premiumTextile,
  kidsPlayful,
  retroOrganic,
  organicAbstract,
  bohoFloral,
  softWatercolorInspired,
] as StyleDnaData[];

export const STYLE_DNA_DATA_BY_ID: Record<string, StyleDnaData> = Object.fromEntries(
  STYLE_DNA_DATA.map((dna) => [dna.id, dna]),
);
