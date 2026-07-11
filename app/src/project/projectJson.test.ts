import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { createProject, addCollectionToProject, updateConcept } from './projectManager';
import { exportProjectJson, importProjectJson } from './projectJson';
import { PROJECT_SCHEMA_VERSION } from './projectTypes';

describe('exportProjectJson / importProjectJson', () => {
  it('round-trips a project with a collection back to an equivalent object', () => {
    let p = addCollectionToProject(createProject('Roundtrip'), generateCollection({ ...defaultParams(), seed: 'json-roundtrip' }));
    p = updateConcept(p, 'spring floral collection');
    const json = exportProjectJson(p);
    const result = importProjectJson(json);
    expect(result.ok).toBe(true);
    // Compare against the JSON-normalized shape (JSON.stringify legitimately
    // drops explicit `undefined` values like `styleDnaId: undefined` — the
    // same thing every round-trip through this exact export path does), not
    // the pre-serialization object.
    expect(result.project).toEqual(JSON.parse(JSON.stringify(p)));
  });

  it('the exported document carries the current schema version and a real exportedAt timestamp', () => {
    const p = createProject('Version');
    const json = exportProjectJson(p);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(typeof parsed.exportedAt).toBe('number');
    expect(parsed.exportedAt).toBeGreaterThan(0);
  });

  it('rejects invalid JSON', () => {
    const result = importProjectJson('{not valid json');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects well-formed JSON that is not a Project export', () => {
    const result = importProjectJson(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a project object missing required array fields', () => {
    const result = importProjectJson(JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), project: { id: 'x', name: 'y' } }));
    expect(result.ok).toBe(false);
  });
});
