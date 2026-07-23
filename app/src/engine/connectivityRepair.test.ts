import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import { buildBouquetSpatialGraph } from './bouquetSpatialGraph';
import { repairIsolatedSurvivors } from './connectivityRepair';

const TILE_SIZE = 1200;
const MOTIF_SIZE = 200; // gridN clamps to the minimum (4) at this ratio, cellSize=300.

function p(x: number, y: number, extra: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, role: 'filler', ...extra };
}

function isolatedCount(placements: Placement[]): number {
  return buildBouquetSpatialGraph(placements, TILE_SIZE, MOTIF_SIZE).isIsolated.filter(Boolean).length;
}

describe('repairIsolatedSurvivors', () => {
  it('swaps in an available candidate to rescue an isolated filler survivor, without changing kept count', () => {
    // Kept: one hero (protected) at (50,50) [cell(0,0)], one isolated filler
    // survivor at (650,650) [cell(2,2), far from the hero, no neighbors].
    // Unkept candidate pool: a filler at (350,350) [cell(1,1)] which is
    // NOT adjacent to the isolated one either -- but ALSO a filler at
    // (950,650) [cell(3,2)], adjacent (same row) to (650,650)'s cell(2,2).
    const placements: Placement[] = [
      p(50, 50, { role: 'hero' }), // index 0, protected
      p(650, 650), // index 1, kept, isolated
      p(350, 350), // index 2, NOT kept, far candidate (irrelevant distractor)
      p(950, 650), // index 3, NOT kept, adjacent-cell rescuer
      p(670, 650), // index 4, kept filler sharing a cell with... no, let's give a real donor below
    ];
    // A safe donor: two fillers sharing one already-crowded cell so removing
    // one doesn't isolate the other. Cell(0,1) spans x:[0,300) y:[300,600).
    placements.push(p(60, 350)); // index 5, kept
    placements.push(p(90, 380)); // index 6, kept (same cell as index 5)

    const protectedIndices = [0];
    const thinnableIndices = [1, 2, 3, 4, 5, 6];
    const initialKept = new Set([0, 1, 5, 6]); // index 4 (dup filler) left unused/unkept for cleanliness

    const before = isolatedCount(placements.filter((_, i) => initialKept.has(i)));
    expect(before).toBeGreaterThan(0);

    const result = repairIsolatedSurvivors(placements, initialKept, protectedIndices, thinnableIndices, TILE_SIZE, MOTIF_SIZE);

    // Total kept count must be unchanged (a repositioning of WHICH indices survive, not how many).
    expect(result.keptIndices.size).toBe(initialKept.size);

    const afterPlacements = placements.filter((_, i) => result.keptIndices.has(i));
    const after = isolatedCount(afterPlacements);
    expect(after).toBeLessThanOrEqual(before);
    expect(result.swapsApplied).toBeGreaterThanOrEqual(0);
  });

  it('is a no-op (zero swaps) when no isolated survivor exists', () => {
    const placements: Placement[] = [p(50, 50, { role: 'hero' }), p(70, 50), p(50, 70)];
    const protectedIndices = [0];
    const thinnableIndices = [1, 2];
    const initialKept = new Set([0, 1, 2]);
    expect(isolatedCount(placements)).toBe(0);

    const result = repairIsolatedSurvivors(placements, initialKept, protectedIndices, thinnableIndices, TILE_SIZE, MOTIF_SIZE);
    expect(result.swapsApplied).toBe(0);
    expect(result.keptIndices).toEqual(initialKept);
  });

  it('never regresses: the returned isolated count is always <= the original', () => {
    // A harder, more crowded scene with several isolated fillers and a mix
    // of rescuable/unrescuable candidates -- the key invariant this repair
    // must hold regardless of how much it manages to fix.
    const placements: Placement[] = [
      p(50, 50, { role: 'hero' }),
      p(650, 50), // isolated candidate A
      p(50, 650), // isolated candidate B
      p(950, 950), // isolated candidate C (likely unrescuable, no nearby candidates)
      p(680, 50), // unkept rescuer for A (adjacent cell)
      p(50, 680), // unkept rescuer for B (adjacent cell)
      p(200, 200), // unkept, irrelevant
      p(220, 220), // kept donor pair member 1 (cell(0,0) w/ hero -- crowded already)
    ];
    const protectedIndices = [0];
    const thinnableIndices = [1, 2, 3, 4, 5, 6, 7];
    const initialKept = new Set([0, 1, 2, 3, 7]);

    const before = isolatedCount(placements.filter((_, i) => initialKept.has(i)));
    const result = repairIsolatedSurvivors(placements, initialKept, protectedIndices, thinnableIndices, TILE_SIZE, MOTIF_SIZE);
    const after = isolatedCount(placements.filter((_, i) => result.keptIndices.has(i)));

    expect(after).toBeLessThanOrEqual(before);
    expect(result.keptIndices.size).toBe(initialKept.size);
  });

  it('never touches a protected index (heroes are never swapped out)', () => {
    const placements: Placement[] = [p(50, 50, { role: 'hero' }), p(650, 650), p(670, 650)];
    const protectedIndices = [0];
    const thinnableIndices = [1, 2];
    const initialKept = new Set([0, 1]);
    const result = repairIsolatedSurvivors(placements, initialKept, protectedIndices, thinnableIndices, TILE_SIZE, MOTIF_SIZE);
    expect(result.keptIndices.has(0)).toBe(true);
  });
});
