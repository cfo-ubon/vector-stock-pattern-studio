// Build 004, Section 2 (Botanical DNA Engine): the 15 named botanical
// families the brief asks for. A real family, as opposed to `motifFactory.
// ts`'s existing `MotifFamily` (one coarse `'flower'` value shared by every
// botanical variant regardless of species) or the generic `rngPick` every
// prior build used inside `botanical.ts`'s own `createMotif` — this is a
// genuinely new taxonomy, not a rename of something that already existed
// (confirmed via this build's own codebase audit).
export type BotanicalFamily =
  | 'rose'
  | 'peony'
  | 'tulip'
  | 'anemone'
  | 'magnolia'
  | 'hydrangea'
  | 'cosmos'
  | 'wildflower'
  | 'daisy'
  | 'lavender'
  | 'eucalyptus'
  | 'olive'
  | 'fern'
  | 'berryBranch'
  | 'herb';

export const BOTANICAL_FAMILIES: BotanicalFamily[] = [
  'rose',
  'peony',
  'tulip',
  'anemone',
  'magnolia',
  'hydrangea',
  'cosmos',
  'wildflower',
  'daisy',
  'lavender',
  'eucalyptus',
  'olive',
  'fern',
  'berryBranch',
  'herb',
];
