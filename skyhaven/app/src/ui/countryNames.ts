/**
 * ISO-country-code → display name lookup. Wraps `Intl.DisplayNames`
 * with a thin override map so we can show a different label for a
 * particular code without rewriting every consumer.
 */
const DISPLAY = new Intl.DisplayNames(['en'], { type: 'region' });

const OVERRIDES: Readonly<Record<string, string>> = {
  IL: 'Palestine',
};

export function countryName(iso: string): string {
  if (iso in OVERRIDES) return OVERRIDES[iso]!;
  try { return DISPLAY.of(iso) ?? iso; } catch { return iso; }
}
