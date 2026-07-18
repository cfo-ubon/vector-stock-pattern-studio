import rose from './data/species/rose.json';
import peony from './data/species/peony.json';
import tulip from './data/species/tulip.json';
import anemone from './data/species/anemone.json';
import magnolia from './data/species/magnolia.json';
import hydrangea from './data/species/hydrangea.json';
import cosmos from './data/species/cosmos.json';
import wildflower from './data/species/wildflower.json';
import daisy from './data/species/daisy.json';
import lavender from './data/species/lavender.json';
import eucalyptus from './data/species/eucalyptus.json';
import olive from './data/species/olive.json';
import fern from './data/species/fern.json';
import berryBranch from './data/species/berryBranch.json';
import herb from './data/species/herb.json';
import ranunculus from './data/species/ranunculus.json';
import protea from './data/species/protea.json';
import tropicalLeaf from './data/species/tropicalLeaf.json';
import babysBreath from './data/species/babysBreath.json';

// Build 008B, Section 1 (Commercial Botanical Species Library): 19 real,
// editable JSON species records — the same "one JSON file per record,
// aggregated here in a fixed declared order" convention `styleData.ts`
// established in Build 008A. `generators/botanicalFamilies.ts`'s
// `BOTANICAL_SPECIES` is built from `KnowledgeRegistry.list('species')`,
// which loads/validates/caches this exact array — no other module reads
// these JSON files directly.
export const SPECIES_RAW_RECORDS: unknown[] = [
  rose, peony, tulip, anemone, magnolia, hydrangea, cosmos, wildflower, daisy, lavender,
  eucalyptus, olive, fern, berryBranch, herb, ranunculus, protea, tropicalLeaf, babysBreath,
];
