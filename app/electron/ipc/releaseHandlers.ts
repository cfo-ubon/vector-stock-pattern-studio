import { ipcMain, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { readWorkspaceConfig } from '../workspaceConfig';
import type { Logger } from '../util/logger';

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export interface PublishReleaseInput {
  version: string;
  artifactPaths: string[]; // absolute paths to the already-built installer/portable files
  releaseNotes: string;
}

export interface PublishReleaseResult {
  releaseDir: string;
  files: string[];
  error: string | null;
}

/** Part 9: copies already-built installer/portable artifacts plus a
 * checksums file and release notes into
 * `<Workspace>/Releases/<version>/`. Does not build anything itself — the
 * actual `electron-builder` run (Part 4/5) produces the artifacts this
 * function only files away. */
export function publishRelease(workspacePath: string, input: PublishReleaseInput): PublishReleaseResult {
  const releaseDir = path.join(workspacePath, 'Releases', input.version);
  try {
    fs.mkdirSync(releaseDir, { recursive: true });
    const checksumLines: string[] = [];
    const copiedFiles: string[] = [];
    for (const src of input.artifactPaths) {
      if (!fs.existsSync(src)) continue;
      const filename = path.basename(src);
      const dest = path.join(releaseDir, filename);
      fs.copyFileSync(src, dest);
      const hash = sha256File(dest);
      checksumLines.push(`${hash}  ${filename}`);
      copiedFiles.push(filename);
    }
    fs.writeFileSync(path.join(releaseDir, 'checksums.sha256'), checksumLines.join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(releaseDir, 'RELEASE_NOTES.txt'), input.releaseNotes, 'utf8');
    return { releaseDir, files: [...copiedFiles, 'checksums.sha256', 'RELEASE_NOTES.txt'], error: null };
  } catch (e) {
    return { releaseDir, files: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function registerReleaseHandlers(userDataDir: string, logger: Logger): void {
  ipcMain.handle('workspace:publishRelease', (_event, input: PublishReleaseInput) => {
    const workspacePath = readWorkspaceConfig(userDataDir).workspacePath;
    if (!workspacePath) throw new Error('No Workspace configured.');
    const result = publishRelease(workspacePath, input);
    logger.info('release', `Published release ${input.version}: ${JSON.stringify(result)}`);
    return result;
  });

  ipcMain.handle('app:openPath', (_event, targetPath: string) => shell.openPath(targetPath));
}
