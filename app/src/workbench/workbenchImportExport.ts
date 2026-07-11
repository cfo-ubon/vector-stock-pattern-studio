import type { DesignSpecification } from '../trend/designSpecTypes';
import { parseDesignSpecificationJson } from '../trend/designSpecValidation';
import { exportTrendPackJson, importTrendPackJson, type TrendPack } from '../trend/trendPacks';
import { downloadBlobFile } from '../export/svgExporter';

// Design Workbench Section 9 ("Import / Export"). Thin file I/O glue only —
// parsing/serialization is entirely delegated to the existing engine
// functions (trend/designSpecValidation.ts, trend/trendPacks.ts); this
// module just turns their JSON strings into a downloaded file, and a
// dropped/picked File into a JSON string to feed back into them.

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function safeFileNamePart(text: string): string {
  return text.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design-spec';
}

export function exportDesignSpecificationFile(spec: DesignSpecification): void {
  const filename = `${safeFileNamePart(spec.project.name)}-design-spec.json`;
  downloadBlobFile(filename, new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json;charset=utf-8' }));
}

export async function readDesignSpecificationFile(file: File): Promise<DesignSpecification> {
  const text = await readFileAsText(file);
  return parseDesignSpecificationJson(text);
}

export function exportTrendPackFile(pack: TrendPack): void {
  const filename = `${safeFileNamePart(pack.id)}-trend-pack.json`;
  downloadBlobFile(filename, new Blob([exportTrendPackJson(pack)], { type: 'application/json;charset=utf-8' }));
}

export async function readTrendPackFile(file: File): Promise<TrendPack> {
  const text = await readFileAsText(file);
  return importTrendPackJson(text);
}
