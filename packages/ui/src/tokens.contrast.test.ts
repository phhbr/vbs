import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = fileURLToPath(new URL("./tokens.css", import.meta.url));
const tokensCss = readFileSync(tokensPath, "utf-8");

/** Text tokens need WCAG AAA (7:1); decorative borders/rules only need 3:1. */
const TEXT_TOKENS = [
  "--vbs-fg",
  "--vbs-fg-dim",
  "--vbs-fg-dim-2",
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

function extractTokens(
  block: string,
  names: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!match) {
      throw new Error(`Token not found: ${name}`);
    }
    result[name] = match[1]!;
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
} as const;

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
  },
);
