import type { Project, ProjectExport } from './projectTypes';
import { PROJECT_SCHEMA_VERSION } from './projectTypes';

// Project JSON — "Everything must save inside one project": a Project's
// full state (concept, moodboard, Style DNA id, every collection's full
// manifest+assets, export history, upload status, notes) serializes to and
// parses back from one JSON document.

export function exportProjectJson(project: Project): string {
  const payload: ProjectExport = { schemaVersion: PROJECT_SCHEMA_VERSION, exportedAt: Date.now(), project };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  ok: boolean;
  project?: Project;
  error?: string;
}

/** Parses and structurally validates a Project JSON file. Deliberately
 * lenient about `schemaVersion` (accepts any number rather than rejecting
 * a mismatch outright) since the shape itself is what's checked — a real
 * future schema bump would need actual field migrations here, not a
 * version-equality gate that just blocks valid-but-differently-versioned
 * files. */
export function importProjectJson(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'ไฟล์ไม่ใช่ JSON ที่ถูกต้อง' };
  }
  const payload = data as Partial<ProjectExport> | undefined;
  const project = payload?.project as Partial<Project> | undefined;
  const valid =
    !!project &&
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    Array.isArray(project.collections) &&
    Array.isArray(project.savedItemIds) &&
    Array.isArray(project.exportHistory);
  if (!valid) {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ Project JSON ที่ถูกต้อง' };
  }
  return { ok: true, project: project as Project };
}
