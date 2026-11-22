import type { CSSProperties } from 'react';
import { Subject } from '../types';

export interface SubjectPresetColor {
  name: string;
  hex: string;
}

export const DEFAULT_SUBJECT_COLOR = '#2563eb';

export const SUBJECT_COLOR_PRESETS: ReadonlyArray<SubjectPresetColor> = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Slate', hex: '#475569' }
];

// Theme surface tokens matching src/index.css
const LIGHT_APP_BG = '#f8fafc';
const LIGHT_SURFACE = '#ffffff';
const LIGHT_SURFACE_RAISED = '#f1f5f9';

const DARK_APP_BG = '#020617';
const DARK_SURFACE = '#0f172a';
const DARK_SURFACE_RAISED = '#1e293b';

export interface SubjectColorTheme {
  name: string;
  value: string;
  hex: string;
  isDark: boolean;
  hardToSee: boolean;
  dotColor: string;
  textColor: string;
  tintBgColor: string;
  borderColor: string;
  selectedBgColor: string;
  selectedBorderColor: string;
  selectedTextColor: string;
  dotStyle: CSSProperties;
  borderLeftStyle: CSSProperties;
  selectorStyle: CSSProperties;
  selectorTextStyle: CSSProperties;
  badgeStyle: CSSProperties;
  iconBoxStyle: CSSProperties;
  iconStyle: CSSProperties;
  chipSelectedStyle: CSSProperties;
  // Structural / compatibility fields
  dotClass: string;
  borderLeftClass: string;
  borderClass: string;
  tintBgClass: string;
  subtleBadge: string;
  textClass: string;
  chipSelectedClass: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Strictly validates a 6-digit hex color string (#RRGGBB).
 */
export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

/**
 * Normalizes a #RGB or #RRGGBB hex string to lowercase #rrggbb.
 * Returns null for invalid strings.
 */
export function normalizeHexColor(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const sixMatch = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (sixMatch) {
    return `#${sixMatch[1].toLowerCase()}`;
  }
  const threeMatch = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (threeMatch) {
    const [r, g, b] = threeMatch[1].toLowerCase().split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/**
 * Resolves any Subject object, hex color, or legacy Tailwind gradient string
 * into a canonical lowercase #rrggbb hex string, falling back to DEFAULT_SUBJECT_COLOR.
 */
export function resolveSubjectHex(colorOrSubject?: string | Subject | null): string {
  const raw =
    typeof colorOrSubject === 'object' && colorOrSubject !== null
      ? colorOrSubject.color
      : colorOrSubject;

  if (!raw || typeof raw !== 'string') {
    return DEFAULT_SUBJECT_COLOR;
  }

  const directHex = normalizeHexColor(raw);
  if (directHex) {
    return directHex;
  }

  const lower = raw.toLowerCase();
  if (lower.includes('emerald') || lower.includes('teal')) return '#059669';
  if (lower.includes('purple') || lower.includes('pink') || lower.includes('violet')) return '#7c3aed';
  if (lower.includes('amber') || lower.includes('orange') || lower.includes('yellow')) return '#d97706';
  if (lower.includes('rose') || lower.includes('red')) return '#e11d48';
  if (lower.includes('slate') || lower.includes('zinc') || lower.includes('gray')) return '#475569';
  if (lower.includes('blue') || lower.includes('indigo')) return '#2563eb';

  return DEFAULT_SUBJECT_COLOR;
}

export function isPresetSubjectColor(hex: string): boolean {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return false;
  return SUBJECT_COLOR_PRESETS.some((p) => p.hex === normalized);
}

function hexToRgb(hex: string): RGB {
  const clean = normalizeHexColor(hex) || DEFAULT_SUBJECT_COLOR;
  const num = parseInt(clean.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  h /= 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  if (sn === 0) {
    const val = Math.round(ln * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255)
  };
}

function relativeLuminance({ r, g, b }: RGB): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatioRgb(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  return contrastRatioRgb(hexToRgb(hex1), hexToRgb(hex2));
}

function compositeOver(fg: RGB, bg: RGB, alpha: number): RGB {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha))
  };
}

function minContrastAgainst(fg: RGB, backgrounds: RGB[]): number {
  let min = Infinity;
  for (const bg of backgrounds) {
    const ratio = contrastRatioRgb(fg, bg);
    if (ratio < min) min = ratio;
  }
  return min;
}

/**
 * Finds a lightness-adjusted shade of (h, s) guaranteeing at least `minRatio`
 * contrast against all `backgrounds`.
 */
function solveAccessibleShade(
  hsl: HSL,
  backgrounds: RGB[],
  direction: 'darker' | 'lighter',
  minRatio: number
): RGB {
  const rawRgb = hslToRgb(hsl);
  if (minContrastAgainst(rawRgb, backgrounds) >= minRatio) {
    return rawRgb;
  }

  if (direction === 'darker') {
    let lo = 0;
    let hi = Math.min(hsl.l, 75);
    let best = hslToRgb({ h: hsl.h, s: hsl.s, l: 0 });
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const candidate = hslToRgb({ h: hsl.h, s: hsl.s, l: mid });
      if (minContrastAgainst(candidate, backgrounds) >= minRatio) {
        best = candidate;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    if (minContrastAgainst(best, backgrounds) < minRatio) {
      return { r: 15, g: 23, b: 42 };
    }
    return best;
  } else {
    let lo = Math.max(hsl.l, 25);
    let hi = 100;
    let best = hslToRgb({ h: hsl.h, s: hsl.s, l: 100 });
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const candidate = hslToRgb({ h: hsl.h, s: hsl.s, l: mid });
      if (minContrastAgainst(candidate, backgrounds) >= minRatio) {
        best = candidate;
        hi = mid;
      } else {
        lo = mid;
      }
    }
    if (minContrastAgainst(best, backgrounds) < minRatio) {
      return { r: 248, g: 250, b: 252 };
    }
    return best;
  }
}

/**
 * Returns true if a chosen raw color is too close to the active theme's page/card backgrounds
 * (e.g., very light in light mode or very dark in dark mode).
 */
export function isColorHardToSee(rawHex: string, isDark: boolean): boolean {
  const rgb = hexToRgb(resolveSubjectHex(rawHex));
  const surface = hexToRgb(isDark ? DARK_SURFACE : LIGHT_SURFACE);
  const appBg = hexToRgb(isDark ? DARK_APP_BG : LIGHT_APP_BG);
  return Math.min(contrastRatioRgb(rgb, surface), contrastRatioRgb(rgb, appBg)) < 1.85;
}

function detectDarkMode(explicitIsDark?: boolean): boolean {
  if (typeof explicitIsDark === 'boolean') return explicitIsDark;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    return root.classList.contains('dark') || root.getAttribute('data-theme') === 'dark';
  }
  return false;
}

/**
 * Derives AA-accessible tint, border, dot, selected-chip, and text colors
 * at render time from a subject's saved hex color (or legacy palette string).
 */
export function getSubjectColorTheme(
  colorOrSubject?: string | Subject | null,
  explicitIsDark?: boolean
): SubjectColorTheme {
  const hex = resolveSubjectHex(colorOrSubject);
  const isDark = detectDarkMode(explicitIsDark);
  const matchedPreset = SUBJECT_COLOR_PRESETS.find((p) => p.hex === hex);

  const rawRgb = hexToRgb(hex);
  const hsl = rgbToHsl(rawRgb);

  const surfaceRgb = hexToRgb(isDark ? DARK_SURFACE : LIGHT_SURFACE);
  const surfaceRaisedRgb = hexToRgb(isDark ? DARK_SURFACE_RAISED : LIGHT_SURFACE_RAISED);
  const appBgRgb = hexToRgb(isDark ? DARK_APP_BG : LIGHT_APP_BG);

  // Build safe subtle tint base (clamp extreme lightness so white/black still give a clean neutral tint)
  const tintBaseRgb = hslToRgb({
    h: hsl.h,
    s: hsl.s,
    l: isDark ? Math.min(Math.max(hsl.l, 45), 72) : Math.min(Math.max(hsl.l, 25), 55)
  });
  const tintAlpha = isDark ? 0.16 : 0.10;
  const tintBgColor = `rgba(${tintBaseRgb.r}, ${tintBaseRgb.g}, ${tintBaseRgb.b}, ${tintAlpha})`;

  // Composite tint over surface and raised surface to verify AA contrast against real rendered backgrounds
  const tintOverSurface = compositeOver(tintBaseRgb, surfaceRgb, tintAlpha);
  const tintOverRaised = compositeOver(tintBaseRgb, surfaceRaisedRgb, tintAlpha);
  const textBackgrounds = [surfaceRgb, surfaceRaisedRgb, tintOverSurface, tintOverRaised];

  // Guarantee >= 4.5:1 AA contrast for text (target 4.8:1 for rounding safety)
  const textRgb = solveAccessibleShade(
    hsl,
    textBackgrounds,
    isDark ? 'lighter' : 'darker',
    4.8
  );
  const textColor = rgbToHex(textRgb);

  // Guarantee >= 3.0:1 visibility for dots, left borders, and icon accents
  const dotRgb = solveAccessibleShade(
    hsl,
    [surfaceRgb, surfaceRaisedRgb, appBgRgb],
    isDark ? 'lighter' : 'darker',
    3.1
  );
  const dotColor = rgbToHex(dotRgb);

  const borderAlpha = isDark ? 0.38 : 0.32;
  const borderColor = `rgba(${dotRgb.r}, ${dotRgb.g}, ${dotRgb.b}, ${borderAlpha})`;

  // Selected source chip: adjusted rich background so white text keeps >= 4.8:1 AA contrast
  const whiteRgb: RGB = { r: 255, g: 255, b: 255 };
  const selectedBgRgb = solveAccessibleShade(hsl, [whiteRgb], 'darker', 4.8);
  const selectedBgColor = rgbToHex(selectedBgRgb);
  const selectedTextColor = '#ffffff';
  // Keep border visible against both light & dark cards even if selectedBgRgb is near #0f172a
  const selectedBorderColor = isDark ? dotColor : selectedBgColor;

  const hardToSee = isColorHardToSee(hex, isDark);

  return {
    name: matchedPreset?.name || 'Custom',
    value: hex,
    hex,
    isDark,
    hardToSee,
    dotColor,
    textColor,
    tintBgColor,
    borderColor,
    selectedBgColor,
    selectedBorderColor,
    selectedTextColor,
    dotStyle: { backgroundColor: dotColor },
    borderLeftStyle: { borderLeftColor: dotColor },
    selectorStyle: { backgroundColor: tintBgColor, borderColor },
    selectorTextStyle: { color: textColor },
    badgeStyle: { backgroundColor: tintBgColor, borderColor, color: textColor },
    iconBoxStyle: { backgroundColor: tintBgColor, borderColor },
    iconStyle: { color: textColor },
    chipSelectedStyle: {
      backgroundColor: selectedBgColor,
      borderColor: selectedBorderColor,
      color: selectedTextColor
    },
    dotClass: '',
    borderLeftClass: 'border-l-4',
    borderClass: '',
    tintBgClass: '',
    subtleBadge: '',
    textClass: '',
    chipSelectedClass: ''
  };
}
