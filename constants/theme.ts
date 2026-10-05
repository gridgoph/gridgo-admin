/**
 * GRIDGO design tokens.
 *
 * This is the JavaScript mirror of `global.css`. Styling belongs in NativeWind
 * classes — reach for these values only where a class cannot go: the React
 * Navigation theme, the status bar, the system UI background, map styles, and
 * anything on the AGENTS.md style exception list.
 *
 * The two files must stay in step. Change a value here and change it there.
 */

import { fontFamily } from "@/constants/fonts";

export type ThemeName = "light" | "dark";

export const colors = {
  light: {
    /** Screen background */
    canvas: "#F8F8F8",
    /** Cards, sheets, navigation */
    surface: "#FFFFFF",
    /** Inactive panels, grouping */
    surfaceVariant: "#F0F0F0",
    /** Selected/elevated panel */
    surfaceHigh: "#FFFFFF",

    /** Headings and core data */
    textPrimary: "#1A1A1A",
    /** Supporting text */
    textSecondary: "#4A4A4A",
    /** Metadata, inactive labels */
    textMuted: "#7A7A7A",

    /** Cards, fields, dividers */
    outline: "#DCDCDC",
    /** Quiet divider */
    outlineSubtle: "#EEEEEE",

    /** Monochrome structural control */
    accent: "#1A1A1A",
    /** Text/icon on accent */
    accentOn: "#FFFFFF",

    /** Small links and badges, "View all" */
    brand: "#D4A017",
    /** GRIDGO logo dot only */
    brandLogo: "#FFDE58",

    /** Primary CTA, current step, active nav, map route */
    actionYellow: "#FFDE58",
    /** Text/icon on actionYellow */
    actionYellowOn: "#1A1A1A",
    /** Recessive ink on the yellow field - the mark's "GO" and the launch line. */
    actionYellowOnMuted: "#5B5B5B",

    /** Digits of the rider's own earnings - dark on the yellow mark in Light */
    earningInk: "#1A1A1A",
    /** Highlighter band behind earnings. Transparent in Dark, where the ink is yellow. */
    earningMark: "#FFDE58",

    /** Approved, completed */
    success: "#2E7D32",
    /** Blocked, failed */
    error: "#C62828",
    /** Risk, attention */
    warning: "#F57F17",
    /** Informational, support */
    info: "#1565C0",

    overlayHover: "rgba(0, 0, 0, 0.04)",
    overlayPressed: "rgba(0, 0, 0, 0.08)",
    scrim: "rgba(0, 0, 0, 0.4)",
  },
  dark: {
    canvas: "#000000",
    surface: "#141414",
    surfaceVariant: "#1E1E1E",
    surfaceHigh: "#2A2A2A",

    textPrimary: "#F0F0F0",
    textSecondary: "#CCCCCC",
    textMuted: "#808080",

    outline: "#2E2E2E",
    outlineSubtle: "#1E1E1E",

    accent: "#F0F0F0",
    accentOn: "#000000",

    brand: "#FFDE58",
    brandLogo: "#FFDE58",

    actionYellow: "#FFDE58",
    actionYellowOn: "#1A1A1A",
    /** Recessive ink on the yellow field - the mark's "GO" and the launch line. */
    actionYellowOnMuted: "#5B5B5B",

    earningInk: "#FFDE58",
    earningMark: "transparent",

    success: "#66BB6A",
    error: "#EF5350",
    warning: "#FFCA28",
    info: "#42A5F5",

    overlayHover: "rgba(255, 255, 255, 0.04)",
    overlayPressed: "rgba(255, 255, 255, 0.08)",
    scrim: "rgba(0, 0, 0, 0.6)",
  },
} as const;

export type ColorToken = keyof typeof colors.light;

/**
 * Type scale. Each step names the Satoshi cut it is set in — React Native
 * resolves a font by family, not by weight. Mirrors the `text-*` utilities.
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.bold },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold },
  h2: { fontSize: 24, lineHeight: 30, fontFamily: fontFamily.bold },
  h3: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.bold },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.regular },
  /** Tab bar labels only — see the note on `text-nav` in global.css. */
  nav: { fontSize: 10, lineHeight: 16, fontFamily: fontFamily.regular },
  button: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.bold },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    fontFamily: fontFamily.medium,
  },
} as const;

/** 4px base. Standard gaps are 8, 12, 16, 24, 32. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 16px page padding on mobile. */
export const pagePadding = 16;

/**
 * Android TextInput content inset. NativeWind class padding can miss the
 * EditText or win the merge, so field call sites apply this native style.
 */
export const fieldInputStyle = {
  paddingStart: spacing.lg,
  paddingEnd: spacing.lg,
  includeFontPadding: false,
  textAlignVertical: "center" as const,
};

/** Fields 12, cards 12–16, pills 999. Do not mix arbitrary values. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  field: 12,
  card: 16,
  pill: 9999,
} as const;

/** Minimum size of every tappable control, in dp. */
export const touchTarget = 44;

/** Emphasis levels for non-default control states. */
export const emphasis = {
  disabled: 0.38,
  hoverOverlay: 0.04,
  pressedOverlay: 0.08,
} as const;

/** 160–240ms ease-out. Respect reduced motion. */
export const motion = {
  fast: 160,
  base: 200,
  slow: 240,
} as const;

/** Border first. Use these only when a border cannot carry the separation. */
export const elevation = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sheet: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
