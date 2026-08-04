import * as fs from 'node:fs';
import * as path from 'node:path';

// Persists the one thing that must survive across launches and must never
// be hardcoded (Part 2: "Never hardcode"): which folder on disk the user
// picked as their Production Workspace. Stored as plain JSON inside
// Electron's own per-user `userData` directory (`app.getPath('userData')`,
// resolved by the caller in main.ts — this module takes it as a parameter
// so it stays testable in plain Node without an Electron runtime).
export interface WorkspaceConfig {
  workspacePath: string | null;
}

const CONFIG_FILENAME = 'workspace-config.json';

export function getConfigPath(userDataDir: string): string {
  return path.join(userDataDir, CONFIG_FILENAME);
}

export function readWorkspaceConfig(userDataDir: string): WorkspaceConfig {
  const configPath = getConfigPath(userDataDir);
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>;
    return { workspacePath: typeof parsed.workspacePath === 'string' ? parsed.workspacePath : null };
  } catch {
    return { workspacePath: null };
  }
}

export function writeWorkspaceConfig(userDataDir: string, config: WorkspaceConfig): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(getConfigPath(userDataDir), JSON.stringify(config, null, 2), 'utf8');
}
