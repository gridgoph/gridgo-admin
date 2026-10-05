import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useThemeColors } from "@/hooks/useTheme";

/**
 * The GRIDGO mark: a 3x3 grid with one corner lit.
 *
 * The grid is the product — a marketplace that routes a print job across a
 * city — and the single yellow dot is the job moving through it. Six
 * structural dots, two muted, one brand.
 *
 * Drawn in SVG rather than nine Views so the same component can be exported
 * for the app icon and splash screen later. `react-native-svg` takes colours
 * as props, which classes cannot reach, so this file reads tokens directly.
 */

/** Circle centres on both axes. 26-unit diameter against a 9-unit gap. */
const CENTRES = [15, 50, 85] as const;
const RADIUS = 13;

/**
 * Product role for the logo lockup family.
 *
 * Labels are fixed copy — never free strings — so a typo cannot ship the wrong
 * product identity. Every role that has a label renders it the same way: plain
 * type under the wordmark. One family, one presentation.
 */
export type GridgoLogoRole =
  | "client"
  | "business"
  | "supplier"
  | "rider"
  | "admin";

type RoleMeta = {
  /** Visible label under the wordmark; null = client individual (wordmark only). */
  label: string | null;
  /** One accessible name for the whole lockup. */
  accessibilityLabel: string;
};

const ROLE_META: Record<GridgoLogoRole, RoleMeta> = {
  client: {
    label: null,
    accessibilityLabel: "GRIDGO",
  },
  business: {
    label: "Business",
    accessibilityLabel: "GRIDGO Business",
  },
  supplier: {
    label: "Supplier",
    accessibilityLabel: "GRIDGO Supplier",
  },
  rider: {
    label: "Rider",
    accessibilityLabel: "GRIDGO Rider",
  },
  admin: {
    label: "Admin",
    accessibilityLabel: "GRIDGO Admin",
  },
};

/** Pure helper for tests and callers that need the a11y string without render. */
export function gridgoLogoAccessibilityLabel(
  role: GridgoLogoRole = "client",
): string {
  return ROLE_META[role].accessibilityLabel;
}

/**
 * Every dimension in the lockup, derived from one number.
 *
 * The mark has to be exactly as tall as the text column beside it, so the two
 * cannot be sized independently — an implicit flex stretch would leave that
 * relationship to Yoga and to whatever font metrics the platform reports.
 * Fixing the line heights here makes the text column height arithmetic, which
 * is what lets the mark match it exactly on every platform, and what the unit
 * test pins.
 *
 * Ratios are measured off the brand lockup reference sheet, where the mark
 * stands 2.7x the height of GRIDGO's caps, the role word's caps are 0.78x
 * GRIDGO's, and the gap to the text is a quarter of the mark's width.
 *
 * Every Satoshi cut shares one cap height per em, so the role's cap ratio is
 * just its type-size ratio: 0.78 of the wordmark, not the ~0.6 an earlier read
 * of the sheet estimated. It stays clamped to the design system's 12px floor.
 *
 * No role label in the lockup ever carries a descender ("Business",
 * "Supplier", "Rider", "Admin"), and the wordmark is all caps, so line heights
 * below the natural leading are safe here in a way they would not be in body
 * copy.
 */
export function gridgoLogoMetrics(size: number) {
  // The wordmark line box hugs its caps, so the mark's top edge lands on the
  // top of GRIDGO rather than floating above it. The role line carries the
  // leading instead: it opens the gap between the two lines and drops the
  // mark's bottom edge just under the role word, as the reference does.
  const wordmarkLineHeight = Math.round(size * 1.08);
  // Nothing essential goes below 12px — the floor wins over the ratio.
  const roleSize = Math.max(12, Math.round(size * 0.78));
  // Leading is what sets both the gap between the two lines and how far the
  // mark drops below the role word, so it is tuned against the sheet, not
  // picked: 1.3 puts the line gap at 0.59x GRIDGO's cap height and the mark at
  // 2.7x it, which is what the reference measures.
  const roleLineHeight = Math.round(roleSize * 1.3);

  return {
    /** Wordmark type size — `size` itself. */
    wordmarkSize: size,
    wordmarkLineHeight,
    roleSize,
    roleLineHeight,
    /** Height of the stacked GRIDGO + role column; the mark matches it. */
    textBlockHeight: wordmarkLineHeight + roleLineHeight,
    /**
     * Mark edge for the wordmark-only lockup. One line cannot carry a
     * two-line mark, so the single-line shape gets its own proportion rather
     * than the two-line one with a row missing.
     */
    soloMarkSize: Math.round(size * 1.4),
    /** Gap between mark and text column. */
    markGap: Math.round(size * 0.45),
  };
}

type MarkProps = {
  /** Rendered edge length in px. The grid scales with it. */
  size?: number;
};

export function GridgoMark({ size = 28 }: MarkProps) {
  const colors = useThemeColors();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {CENTRES.map((cy, row) =>
        CENTRES.map((cx, column) => (
          <Circle
            key={`${row}-${column}`}
            cx={cx}
            cy={cy}
            r={RADIUS}
            // Columns 1-2 are structural, so they invert with the theme. Only
            // the top-right dot holds yellow, and it holds it in both themes.
            fill={
              column < 2
                ? colors.accent
                : row === 0
                  ? colors.brandLogo
                  : colors.textMuted
            }
          />
        )),
      )}
    </Svg>
  );
}

type Props = {
  /**
   * Wordmark type size in px — the one number the whole lockup scales from.
   *
   * It is deliberately *not* the mark's edge length any more. Under the
   * reference layout the mark spans the full two-line text block, so its
   * height is a consequence of the type, not an independent input: see
   * `gridgoLogoMetrics`. Default 20 matches the `text-h3` step the wordmark
   * used before this changed, so the wordmark itself is unchanged at defaults.
   */
  size?: number;
  /**
   * Product role lockup. Omit or pass `"client"` for the bare wordmark (no
   * role label). Every other role stacks its label under the wordmark, in the
   * same ink at a lighter cut, left-aligned with GRIDGO.
   */
  role?: GridgoLogoRole;
};

/**
 * Mark plus wordmark, optionally with a role lockup.
 *
 * Layout (from the brand lockup reference sheet): the mark sits left and spans
 * the **full height of the text block** — its top edge on the top of GRIDGO,
 * its bottom edge under the role word. The wordmark and role stack in a column
 * to its right. With no role there is one line, so the mark takes its own
 * single-line proportion instead.
 *
 * `GO` uses `brand`, not `actionYellow`. `#FFDE58` on the light canvas is
 * illegible, and `brand` resolves to `#D4A017` in Light and `#FFDE58` in
 * Dark — yellow in both themes, without spending the screen's one CTA colour.
 * Yellow appears exactly twice in the lockup: that `GO`, and the single lit
 * dot in the mark.
 *
 * Type does not scale with the OS text size. The lockup is identity, not copy;
 * scaling one part of it would break the mark-to-text-block alignment that is
 * the whole point of the shape. The accessible name carries the meaning.
 *
 * The whole lockup is one accessible image node.
 */
export function GridgoLogo({ size = 20, role = "client" }: Props) {
  const meta = ROLE_META[role];
  const metrics = gridgoLogoMetrics(size);

  return (
    <View
      // Dynamic gap and cross-axis alignment: both are computed from `size`,
      // which a class cannot reach.
      className="flex-row"
      style={{
        columnGap: metrics.markGap,
        // Two-line lockup: the mark is exactly the column's height, so top
        // alignment and centring agree — flex-start states the intent.
        // One-line lockup: the mark is taller than the line, so it centres.
        alignItems: meta.label ? "flex-start" : "center",
      }}
      // Collapses the mark, wordmark, and role into one node, so a screen
      // reader says e.g. "GRIDGO Rider" once rather than spelling out pieces.
      accessible
      accessibilityRole="image"
      accessibilityLabel={meta.accessibilityLabel}
    >
      <GridgoMark
        size={meta.label ? metrics.textBlockHeight : metrics.soloMarkSize}
      />
      <View className="min-w-0 shrink">
        <Text
          className="font-brand text-text-primary"
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontSize: metrics.wordmarkSize,
            lineHeight: metrics.wordmarkLineHeight,
          }}
        >
          GRID<Text className="text-brand">GO</Text>
        </Text>
        {meta.label ? (
          // Same ink as the wordmark, a lighter cut and ~0.6x the size. It is
          // part of the lockup, not metadata under it, so it does not take the
          // muted grey.
          <Text
            className="font-normal text-text-primary"
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontSize: metrics.roleSize,
              lineHeight: metrics.roleLineHeight,
            }}
          >
            {meta.label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
