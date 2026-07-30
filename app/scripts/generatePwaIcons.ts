import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Build 027 Phase 2 — rasterizes the app's existing brand SVG (the same
// inline favicon already in index.html — a blue rounded square with two
// circles, no third-party asset) into the PNG set a web app manifest
// requires, using the same Playwright + headless Chromium canvas
// technique already proven in this repo (generateDesktopIcons.ts,
// Portfolio Phase 1's PNG previews). No native canvas/sharp dependency
// needed.

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BRAND_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='#5b8dee'/><circle cx='11' cy='11' r='5' fill='#fff'/><circle cx='22' cy='22' r='5' fill='#fff' opacity='.7'/></svg>";

// Maskable icons must survive an OS applying a circular/squircle crop, so
// all meaningful content must sit inside a centered "safe zone" circle
// covering ~80% of the canvas (the maskable-icon spec's safe-zone
// guidance) with the background filling the full bleed — no baked-in
// rounded corners, since the OS mask supplies its own shape.
const MASKABLE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
  "<rect width='32' height='32' fill='#5b8dee'/>" +
  "<circle cx='12.8' cy='12.8' r='4' fill='#fff'/>" +
  "<circle cx='21.6' cy='21.6' r='4' fill='#fff' opacity='.7'/>" +
  '</svg>';

// iOS apple-touch-icon: Safari composites its own rounded-corner mask and
// does not honor transparency well, so this variant is full-bleed opaque
// (identical background treatment to MASKABLE_SVG, standard icon content).
const APPLE_TOUCH_SVG = BRAND_SVG.replace("rx='6'", "rx='0'");

interface IconSpec {
  svg: string;
  size: number;
  fileName: string;
}

const ICONS: IconSpec[] = [
  { svg: BRAND_SVG, size: 64, fileName: 'icon-64.png' },
  { svg: BRAND_SVG, size: 192, fileName: 'icon-192.png' },
  { svg: BRAND_SVG, size: 512, fileName: 'icon-512.png' },
  { svg: MASKABLE_SVG, size: 192, fileName: 'icon-192-maskable.png' },
  { svg: MASKABLE_SVG, size: 512, fileName: 'icon-512-maskable.png' },
  { svg: APPLE_TOUCH_SVG, size: 180, fileName: 'apple-touch-icon.png' },
];

async function rasterizeSvgToPng(page: import('playwright').Page, svgString: string, size: number): Promise<Buffer> {
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

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();

  for (const icon of ICONS) {
    const png = await rasterizeSvgToPng(page, icon.svg, icon.size);
    const outPath = path.join(OUT_DIR, icon.fileName);
    fs.writeFileSync(outPath, png);
    console.log(`Wrote ${outPath} (${png.length} bytes)`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
