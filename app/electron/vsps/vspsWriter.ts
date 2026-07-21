import { buildZip, type ZipEntry } from '../../src/export/zip';
import type { VspsManifest } from '../ipcContract';

// Builds a `.vsps` project package: a ZIP (reusing the app's own existing,
// unmodified `export/zip.ts` writer — the same STORE-method writer every
// Collection/Production-Mode ZIP download already uses) containing
// `manifest.json` (new, thin — see DESKTOP_MIGRATION_AUDIT.md Section 8)
// and `project.json` (the EXACT string `exportProjectJson()` already
// produces, passed in unmodified by the caller — this file never
// re-serializes Project data itself).

export const VSPS_SCHEMA_VERSION = 1;

export interface BuildVspsInput {
  projectJson: string;
  projectId: string;
  projectName: string;
  appVersion: string;
  createdAt: number;
  updatedAt: number;
  previews?: Array<{ filename: string; pngBytes: Uint8Array }>;
}

export async function buildVspsPackage(input: BuildVspsInput): Promise<Buffer> {
  const manifest: VspsManifest = {
    schema_version: VSPS_SCHEMA_VERSION,
    app_version: input.appVersion,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    project_id: input.projectId,
    project_name: input.projectName,
  };

  const entries: ZipEntry[] = [
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
    { name: 'project.json', data: new TextEncoder().encode(input.projectJson) },
  ];
  for (const preview of input.previews ?? []) {
    entries.push({ name: `previews/${preview.filename}`, data: preview.pngBytes });
  }

  const blob = buildZip(entries);
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
