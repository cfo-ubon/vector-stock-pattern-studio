import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveExportToWorkspace, saveCommercialPackageToWorkspace, saveSubmissionPackageToWorkspace } from './workspaceExportIntegration';

function fakeResult(filename: string): { blob: Blob; filename: string } {
  return { blob: new Blob(['fake zip content']), filename };
}

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'workspaceAPI');
  vi.restoreAllMocks();
});

describe('saveExportToWorkspace', () => {
  it('no-ops outside the Electron desktop runtime', async () => {
    expect(await saveExportToWorkspace(fakeResult('batch-2-patterns.zip'))).toBeNull();
  });

  it('writes into Export/<filename> when running desktop', async () => {
    const writeFile = vi.fn().mockResolvedValue({ path: '/workspace/Export/batch-2-patterns.zip', bytes: 17 });
    (window as unknown as { workspaceAPI: unknown }).workspaceAPI = { writeFile };
    const result = await saveExportToWorkspace(fakeResult('batch-2-patterns.zip'));
    expect(writeFile).toHaveBeenCalledWith('Export/batch-2-patterns.zip', expect.any(ArrayBuffer));
    expect(result).toEqual({ path: '/workspace/Export/batch-2-patterns.zip', bytes: 17 });
  });
});

describe('saveCommercialPackageToWorkspace', () => {
  it('writes into CommercialPackages/<filename> when running desktop', async () => {
    const writeFile = vi.fn().mockResolvedValue({ path: '/workspace/CommercialPackages/pkg.zip', bytes: 17 });
    (window as unknown as { workspaceAPI: unknown }).workspaceAPI = { writeFile };
    await saveCommercialPackageToWorkspace(fakeResult('pkg.zip'));
    expect(writeFile).toHaveBeenCalledWith('CommercialPackages/pkg.zip', expect.any(ArrayBuffer));
  });
});

describe('saveSubmissionPackageToWorkspace', () => {
  it('routes known marketplace ids to the literal folder names the deployment spec requires', async () => {
    const writeFile = vi.fn().mockResolvedValue({ path: '/workspace/Marketplace/Shutterstock/pkg.zip', bytes: 17 });
    (window as unknown as { workspaceAPI: unknown }).workspaceAPI = { writeFile };
    await saveSubmissionPackageToWorkspace('shutterstock', fakeResult('pkg.zip'));
    expect(writeFile).toHaveBeenCalledWith('Marketplace/Shutterstock/pkg.zip', expect.any(ArrayBuffer));

    await saveSubmissionPackageToWorkspace('adobestock', fakeResult('pkg2.zip'));
    expect(writeFile).toHaveBeenCalledWith('Marketplace/Adobe/pkg2.zip', expect.any(ArrayBuffer));
  });

  it('falls back to a capitalized folder name for marketplace ids the spec does not literally name', async () => {
    const writeFile = vi.fn().mockResolvedValue({ path: '/workspace/Marketplace/Creativefabrica/pkg.zip', bytes: 17 });
    (window as unknown as { workspaceAPI: unknown }).workspaceAPI = { writeFile };
    await saveSubmissionPackageToWorkspace('creativefabrica', fakeResult('pkg.zip'));
    expect(writeFile).toHaveBeenCalledWith('Marketplace/Creativefabrica/pkg.zip', expect.any(ArrayBuffer));
  });
});
