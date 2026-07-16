import editorialBotanical from './data/styles/editorialBotanical.json';
import luxuryFloral from './data/styles/luxuryFloral.json';
import scandinavianOrganic from './data/styles/scandinavianOrganic.json';
import minimalBotanical from './data/styles/minimalBotanical.json';
import vintageHerbarium from './data/styles/vintageHerbarium.json';
import darkBotanical from './data/styles/darkBotanical.json';
import modernTropical from './data/styles/modernTropical.json';
import boutiquePackaging from './data/styles/boutiquePackaging.json';
import luxuryWallpaper from './data/styles/luxuryWallpaper.json';
import premiumTextile from './data/styles/premiumTextile.json';
import kidsPlayful from './data/styles/kidsPlayful.json';
import retroOrganic from './data/styles/retroOrganic.json';
import organicAbstract from './data/styles/organicAbstract.json';
import bohoFloral from './data/styles/bohoFloral.json';
import softWatercolorInspired from './data/styles/softWatercolorInspired.json';

// Build 008A, Section 5 (Knowledge Loader): the 15 built-in Style DNA
// records as real, editable JSON — ported 1:1 (byte-identical field
// values, verified against `engine/styleDna.ts`'s own `STYLE_DNA_PRESETS`
// by the dump script used to generate these files) from the app's real,
// actively-used Style DNA source, NOT from the older, stale `style-dna/
// *.json` snapshot (see BUILD_008A_AUDIT.md §0 for why that one is a
// different, disconnected system). `engine/styleDna.ts` now builds its
// exported `STYLE_DNA_PRESETS` from `KnowledgeRegistry.list('style')`
// instead of a hardcoded object literal — this array is that Registry's
// one raw input, kept in the same declared-array order the original
// object literal used (insertion order matters for `Object.values`-based
// consumers that assume a stable, meaningful ordering).
export const STYLE_RAW_RECORDS: unknown[] = [
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
];
