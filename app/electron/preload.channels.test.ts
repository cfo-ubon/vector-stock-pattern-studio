import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS } from './ipcContract';

// Regression test for a real bug found in this session: `preload.ts` must
// duplicate `IPC_CHANNELS` as a runtime value (rather than importing it)
// because Electron's sandboxed preload environment cannot `require()`
// sibling project files — verified directly by launching the compiled
// shell, which failed with "module not found: ./ipcContract" before this
// fix. That duplication has no compiler-enforced guarantee of staying in
// sync, so this test parses `preload.ts`'s source text for its inlined
// array and diffs it against the real `IPC_CHANNELS` allowlist.
describe('preload.ts channel allowlist stays in sync with ipcContract.ts', () => {
  it('inlines every channel from IPC_CHANNELS, and nothing else', () => {
    const preloadSource = fs.readFileSync(path.join(__dirname, 'preload.ts'), 'utf8');
    const arrayMatch = preloadSource.match(/const IPC_CHANNELS: readonly IpcChannel\[\] = \[([\s\S]*?)\];/);
    expect(arrayMatch).not.toBeNull();
    const inlined = Array.from(arrayMatch![1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
    expect(inlined.sort()).toEqual([...IPC_CHANNELS].sort());
  });
});
