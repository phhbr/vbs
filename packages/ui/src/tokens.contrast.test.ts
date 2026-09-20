import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = fileURLToPath(new URL("./tokens.css", import.meta.url));
const tokensCss = readFileSync(tokensPath, "utf-8");

/** Text tokens need WCAG AAA (7:1) against the page background. */
const TEXT_TOKENS = [
  "--vbs-fg",
  "--vbs-fg-dim",
  "--vbs-fg-strong",
  "--vbs-accent",
  "--vbs-danger",
] as const;
/** Body, dim, and accent text also render on a Panel — checked separately
 * only where a theme's panel is a real, distinct color (see
 * PANEL_THEMES below); everywhere else a panel is transparent, i.e. the
 * same color as the page, and already covered by the checks above. */
const PANEL_TEXT_TOKENS = ["--vbs-fg", "--vbs-fg-dim", "--vbs-accent"] as const;
const DIVIDER_TOKEN = "--vbs-divider";
const CONTROL_BORDER_TOKEN = "--vbs-control-border";

function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) {
    throw new Error(`Selector not found in tokens.css: ${selector}`);
  }
  const braceStart = css.indexOf("{", start);
  const braceEnd = css.indexOf("}", braceStart);
  return css.slice(braceStart, braceEnd);
}

// A few tokens (amt/vb6's title-bg/title-fg, vb6's panel-bg) are defined as
// var(--other-token) rather than a literal hex, to keep them tied to that
// token's single definition instead of repeating its value. Resolve one
// level of that indirection within the same block rather than duplicating
// the hex.
function resolveToken(block: string, name: string): string {
  const match = block.match(
    new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6}|var\\((--[a-z-]+)\\))`),
  );
  if (!match) {
    throw new Error(`Token not found: ${name}`);
  }
  const [, value, ref] = match;
  return value!.startsWith("#") ? value! : resolveToken(block, ref!);
}

function extractTokens(
  block: string,
  names: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = resolveToken(block, name);
  }
  return result;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

// modernLight is the default: bare :root carries its values directly (see
// tokens.css), the same way :root[data-theme="dark"] alone used to be
// enough before this theme existed.
const THEME_SELECTORS = {
  modernLight: ':root,\n:root[data-theme="modernLight"]',
  modernDark: ':root[data-theme="modernDark"]',
  light: ':root[data-theme="light"]',
  dark: ':root[data-theme="dark"]',
  amt: ':root[data-theme="amt"]',
  vb6: ':root[data-theme="vb6"]',
} as const;

const THEMES = Object.fromEntries(
  Object.entries(THEME_SELECTORS).map(([name, selector]) => [
    name,
    extractBlock(tokensCss, selector),
  ]),
) as Record<keyof typeof THEME_SELECTORS, string>;

// Only Behörde and Fachanwendung fill the title bar with a real color —
// every other theme leaves --vbs-title-bg: transparent, which isn't a pair
// to check (and isn't a hex value extractTokens' regex would even match).
const THEMES_WITH_TITLE_FILL = {
  amt: THEMES.amt,
  vb6: THEMES.vb6,
} as const;

// Only the two modern themes give a Panel a real, distinct background —
// every other theme leaves --vbs-panel-bg transparent (or, for vb6, equal
// to --vbs-bg), so text-on-panel there is the exact same pair as
// text-on-background, already covered above.
const PANEL_THEMES = {
  modernLight: THEMES.modernLight,
  modernDark: THEMES.modernDark,
} as const;

// Every theme gives --vbs-divider a real color *except* the two modern
// ones, which deliberately drop it below 3:1 — a hairline good only for a
// decorative rule, never a control's edge (see tokens.css's note on
// modernLight and CLAUDE.md's token-review finding 2). Those two rely on
// --vbs-control-border instead, checked separately below.
const DIVIDER_THEMES = {
  light: THEMES.light,
  dark: THEMES.dark,
  amt: THEMES.amt,
  vb6: THEMES.vb6,
} as const;

// --vbs-control-border needs a real color in every theme except vb6, whose
// controls are edgeless by design — the Win9x bevel shadow (not a border
// color) is what reads as their edge there, so there is nothing to check.
const CONTROL_BORDER_THEMES = {
  modernLight: THEMES.modernLight,
  modernDark: THEMES.modernDark,
  light: THEMES.light,
  dark: THEMES.dark,
  amt: THEMES.amt,
} as const;

describe.each(Object.entries(THEMES))(
  "token contrast — %s theme",
  (_name, block) => {
    const bg = extractTokens(block, ["--vbs-bg"])["--vbs-bg"]!;

    it.each(TEXT_TOKENS)("%s reaches 7:1 against the background", (token) => {
      const color = extractTokens(block, [token])[token]!;
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(7);
    });

    // The selected card and the consensus badge print --vbs-on-accent text on
    // an --vbs-accent fill, not on the page background — a different pair
    // than every other text token, so it needs its own check.
    it("--vbs-on-accent reaches 7:1 against --vbs-accent", () => {
      const { "--vbs-on-accent": onAccent, "--vbs-accent": accent } =
        extractTokens(block, ["--vbs-on-accent", "--vbs-accent"]);
      expect(contrastRatio(onAccent!, accent!)).toBeGreaterThanOrEqual(7);
    });
  },
);

describe.each(Object.entries(DIVIDER_THEMES))(
  "token contrast — %s theme",
  (_name, block) => {
    it(`${DIVIDER_TOKEN} reaches 3:1 against the background`, () => {
      const bg = extractTokens(block, ["--vbs-bg"])["--vbs-bg"]!;
      const color = extractTokens(block, [DIVIDER_TOKEN])[DIVIDER_TOKEN]!;
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(3);
    });
  },
);

describe.each(Object.entries(CONTROL_BORDER_THEMES))(
  "token contrast — %s theme",
  (_name, block) => {
    it(`${CONTROL_BORDER_TOKEN} reaches 3:1 against the background`, () => {
      const bg = extractTokens(block, ["--vbs-bg"])["--vbs-bg"]!;
      const color = extractTokens(block, [CONTROL_BORDER_TOKEN])[
        CONTROL_BORDER_TOKEN
      ]!;
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(3);
    });
  },
);

describe.each(Object.entries(PANEL_THEMES))(
  "token contrast — %s theme panel",
  (_name, block) => {
    const panelBg = extractTokens(block, ["--vbs-panel-bg"])[
      "--vbs-panel-bg"
    ]!;

    it.each(PANEL_TEXT_TOKENS)("%s reaches 7:1 against the panel", (token) => {
      const color = extractTokens(block, [token])[token]!;
      expect(contrastRatio(color, panelBg)).toBeGreaterThanOrEqual(7);
    });
  },
);

// Only the heading text itself sits on --vbs-title-bg (finding: "only the
// heading itself gets the bar, not the whole header row with its buttons"),
// so this checks that exact pair rather than reusing the background-based
// checks above.
describe.each(Object.entries(THEMES_WITH_TITLE_FILL))(
  "token contrast — %s theme title bar",
  (_name, block) => {
    it("--vbs-title-fg reaches 7:1 against --vbs-title-bg", () => {
      const { "--vbs-title-fg": titleFg, "--vbs-title-bg": titleBg } =
        extractTokens(block, ["--vbs-title-fg", "--vbs-title-bg"]);
      expect(contrastRatio(titleFg!, titleBg!)).toBeGreaterThanOrEqual(7);
    });
  },
);
