import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Desktop migration Phase 7 — generates the Windows icon set from the
// app's own existing branding (the inline SVG favicon already in
// `index.html` — a blue rounded square with two circles, no third-party
// or copyrighted asset). Rasterizes each required size via the same
// Playwright + headless Chromium technique already proven this session
// (Portfolio Phase 1's PNG previews, Phase 1B's contact sheets), then
// hand-writes a valid multi-resolution .ico (PNG-compressed entries per
// size — supported by Windows since Vista, and far simpler than BMP-
// encoding each frame by hand).

const FAVICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='#5b8dee'/><circle cx='11' cy='11' r='5' fill='#fff'/><circle cx='22' cy='22' r='5' fill='#fff' opacity='.7'/></svg>";

const SIZES = [16, 24, 32, 48, 64, 128, 256];
// Windows .ico files conventionally embed a curated subset, not every
// generated PNG size — 16/32/48/256 covers taskbar, desktop, and Explorer
// "large icons" views.
const ICO_SIZES = [16, 32, 48, 256];

function __dirnameFromUrl(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

async function rasterizeSvgToPng(page: any, svgString: string, size: number): Promise<Buffer> {
  const dataUrl: string = await page.evaluate(
    async ({ svgString, size }: { svgString: string; size: number }) => {
      return await new Promise<string>((resolve, reject) => {
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('SVG rasterization failed'));
        };
        img.src = url;
      });
    },
    { svgString, size },
  );
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

/** Builds a valid Windows .ico file from a set of PNG-encoded images
 * (ICONDIR + ICONDIRENTRY[] + raw PNG data per entry — the modern,
 * PNG-payload ICO format Windows has supported since Vista). */
function buildIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  const dataChunks: Buffer[] = [];
  let offset = dirSize;

  for (const { size, png } of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // data size
    entry.writeUInt32LE(offset, 12); // data offset
    entries.push(entry);
    dataChunks.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...dataChunks]);
}

async function main() {
  const __dirname = __dirnameFromUrl();
  const outDir = path.join(__dirname, '..', 'build', 'icons');
  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs' as string);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');

  const pngsBySize = new Map<number, Buffer>();
  for (const size of SIZES) {
    const png = await rasterizeSvgToPng(page, FAVICON_SVG, size);
    pngsBySize.set(size, png);
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
    console.log(`Wrote icon-${size}.png (${png.length} bytes)`);
  }
  // `icon.png` — the general-purpose 256px PNG main.ts uses for the
  // BrowserWindow icon (works cross-platform in dev; Windows uses icon.ico
  // for the installer/taskbar/shortcut).
  fs.writeFileSync(path.join(outDir, 'icon.png'), pngsBySize.get(256)!);

  const icoImages = ICO_SIZES.map((size) => ({ size, png: pngsBySize.get(size)! }));
  const ico = buildIco(icoImages);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
  console.log(`Wrote icon.ico (${ico.length} bytes, sizes: ${ICO_SIZES.join(', ')})`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
