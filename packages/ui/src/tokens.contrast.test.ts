import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = fileURLToPath(new URL("./tokens.css", import.meta.url));
const tokensCss = readFileSync(tokensPath, "utf-8");

/** Text tokens need WCAG AAA (7:1); decorative borders/rules only need 3:1. */
const TEXT_TOKENS = [
  "--vbs-fg",
  "--vbs-fg-dim",
  "--vbs-fg-strong",
  "--vbs-accent",
  "--vbs-danger",
] as const;
const NON_TEXT_TOKENS = ["--vbs-divider"] as const;

function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) {
    throw new Error(`Selector not found in tokens.css: ${selector}`);
  }
  const braceStart = css.indexOf("{", start);
  const braceEnd = css.indexOf("}", braceStart);
  return css.slice(braceStart, braceEnd);
}

// A few tokens (amt's title-bg/title-fg) are defined as var(--other-token)
// rather than a literal hex, to keep them tied to that token's single
// definition instead of repeating its value. Resolve one level of that
// indirection within the same block rather than duplicating the hex.
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

const THEMES = {
  dark: extractBlock(tokensCss, ':root,\n:root[data-theme="dark"]'),
  light: extractBlock(tokensCss, ':root[data-theme="light"]'),
  amt: extractBlock(tokensCss, ':root[data-theme="amt"]'),
} as const;

// Only Behörde fills the title bar with a real color — light/dark leave
// --vbs-title-bg: transparent, which isn't a pair to check (and isn't a hex
// value extractTokens' regex would even match).
const THEMES_WITH_TITLE_FILL = { amt: THEMES.amt } as const;

describe.each(Object.entries(THEMES))(
  "token contrast — %s theme",
  (_name, block) => {
    const bg = extractTokens(block, ["--vbs-bg"])["--vbs-bg"]!;

    it.each(TEXT_TOKENS)("%s reaches 7:1 against the background", (token) => {
      const color = extractTokens(block, [token])[token]!;
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(7);
    });

    it.each(NON_TEXT_TOKENS)(
      "%s reaches 3:1 against the background",
      (token) => {
        const color = extractTokens(block, [token])[token]!;
        expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(3);
      },
    );

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
