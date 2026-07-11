/** Shared 0-100 score -> traffic-light color mapping, used by every score
 * bar in the app (Quality Score, SEO Analyzer) so they share one visual
 * convention. Kept in its own module (not exported alongside a component)
 * so component files stay Fast-Refresh-clean. */
export function scoreColor(v: number): string {
  if (v >= 80) return '#5fbf7f';
  if (v >= 55) return '#e0b84a';
  return '#e0715a';
}
