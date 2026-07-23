# Style DNA Diagnostic Matrix — Build 022

Generated from a real 450-pattern sample (15 presets x 30 seeds, fixed seed set `m22-1`..`m22-30`, deterministic/reproducible), using the app's own existing evaluation pipeline (`scripts/qualityReport.ts`'s `evaluate`/`buildPortfolioParams`/`breakdownBy` — no new scoring logic). Sorted weakest-to-strongest by Absolute Commercial Quality.

| Preset | Commercial | Composition | Hero Vis. | Hierarchy | Style-Fit | Product-Target Fit | Illustration V2 | Flower Realism | Visual Richness | Palette Contrast | Fail% | Top failure mode |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Minimal Botanical | 39.17 | 95.33 | 82.93 | 59.33 | 78.07 | 56.73 | 54.2 | 0 | 57.37 | 100 | 86.67% | penalty:gridAppearance (100% of samples) |
| Boutique Packaging | 39.73 | 95.9 | 84.45 | 55.43 | 76.07 | 59.63 | n/a | n/a | n/a | 100 | 83.33% | penalty:gridAppearance (100% of samples) |
| Premium Textile | 46.07 | 100 | 80.12 | 63.87 | 69.03 | 54.6 | n/a | n/a | n/a | 100 | 96.67% | penalty:gridAppearance (100% of samples) |
| Luxury Floral | 63.27 | 98.67 | 86.97 | 39.63 | 83.03 | 50 | 81.53 | 100 | 57.47 | 100 | 33.33% | issue:fragmentedSilhouette (100% of samples) |
| Vintage Herbarium | 67.8 | 100 | 86.2 | 83.6 | 59.67 | 57 | 61.23 | 0 | 70.37 | 100 | 43.33% | penalty:gridAppearance (46.67% of samples) |
| Dark Botanical | 68.47 | 100 | 89.32 | 50.73 | 78.4 | 50 | 69.77 | 56.67 | 62.93 | 100 | 26.67% | issue:fragmentedSilhouette (66.67% of samples) |
| Luxury Wallpaper | 72.8 | 100 | 86.43 | 100 | 69.03 | 50 | n/a | n/a | n/a | 100 | 26.67% | penalty:gridAppearance (40% of samples) |
| Editorial Botanical | 84.3 | 100 | 99.97 | 99.87 | 78.17 | 57 | 79.73 | 100 | 64.13 | 100 | 0% | issue:tooManyFillers (56.67% of samples) |
| Kids Playful | 85.23 | 94.47 | 89.94 | 100 | 44.53 | 56 | n/a | n/a | n/a | 100 | 0% | issue:lowDetail (100% of samples) |
| Boho Floral | 85.67 | 85.93 | 95.01 | 100 | 70.1 | 54.8 | 62.21 | 0 | 59 | 100 | 0% | issue:lowDetail (36.67% of samples) |
| Scandinavian Organic | 86.03 | 100 | 91.65 | 90.9 | 51.3 | 54.2 | 57.63 | 0 | 60.13 | 100 | 0% | issue:lowDetail (46.67% of samples) |
| Retro Organic | 86.37 | 89.77 | 91.78 | 100 | 61.27 | 51.37 | n/a | n/a | n/a | 100 | 0% | issue:lowDetail (63.33% of samples) |
| Soft Watercolor Inspired (Vector only) | 86.87 | 99.07 | 90.57 | 86.5 | 58.9 | 51.2 | 63.73 | 0 | 61.36 | 100 | 0% | issue:lowDetail (63.33% of samples) |
| Modern Tropical | 87.63 | 100 | 83.63 | 100 | 69.17 | 54 | n/a | n/a | n/a | 100 | 0% | issue:tooManyFillers (46.67% of samples) |
| Organic Abstract | 88.23 | 97.47 | 98.41 | 92.07 | 64.1 | 51 | n/a | n/a | n/a | 100 | 0% | issue:lowDetail (100% of samples) |

Full per-metric breakdown (composition sub-scores, all penalty/issue rates) in `STYLE_DNA_DIAGNOSTIC_MATRIX.json`.
