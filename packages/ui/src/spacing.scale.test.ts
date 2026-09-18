import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Finding 5 of the design revision: every gap in the app is 10, 20, or
 * 40px — no other values anywhere. This scans every .module.css file for
 * gap/padding/margin declarations and fails on any px literal outside that
 * scale, the same way tokens.contrast.test.ts fails on a color that misses
 * AAA — a stray value is a bug, not a style nit.
 *
 * Scoped to spacing properties only: fixed component dimensions
 * (--vbs-touch-target, --vbs-card-min-size) and border widths are a
 * different kind of constant and aren't covered here.
 */
const ALLOWED_PX = new Set([0, 10, 20, 40]);

const uiSrcDir = dirname(fileURLToPath(import.meta.url));
const webSrcDir = resolve(uiSrcDir, "../../../apps/web/src");
const ROOTS = [uiSrcDir, webSrcDir];

function findModuleCssFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...findModuleCssFiles(path));
    } else if (entry.name.endsWith(".module.css")) {
      files.push(path);
    }
  }
  return files;
}

const SPACING_PROPERTY =
  /(?:^|[{;])\s*((?:row-|column-)?gap|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?)\s*:\s*([^;}]+)/g;
const PX_LITERAL = /(-?\d+(?:\.\d+)?)px/g;

function findViolations(css: string): string[] {
  const violations: string[] = [];
  for (const match of css.matchAll(SPACING_PROPERTY)) {
    const [, property, value] = match;
    for (const pxMatch of value!.matchAll(PX_LITERAL)) {
      const px = Number(pxMatch[1]);
      if (!ALLOWED_PX.has(px)) {
        violations.push(`${property}: ${value!.trim()} (${px}px not in 0/10/20/40)`);
      }
    }
  }
  return violations;
}

const files = ROOTS.filter((root) => {
  try {
    return statSync(root).isDirectory();
  } catch {
    return false;
  }
}).flatMap(findModuleCssFiles);

it("found at least one .module.css file to check", () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(files)("spacing scale — %s", (file) => {
  it("uses only 10/20/40px gaps, padding, and margins", () => {
    const css = readFileSync(file, "utf-8");
    expect(findViolations(css)).toEqual([]);
  });
});
