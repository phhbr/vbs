import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const THEMES = [
  "modernLight",
  "modernDark",
  "light",
  "dark",
  "amt",
  "vb6",
] as const;
const LOCALES = ["de", "en"] as const;

// Same two storage keys theme-bootstrap.js itself reads pre-paint (see its
// own comment) — an init script sets them before the very first navigation,
// same effect as a returning visitor with a stored preference.
async function primeThemeAndLocale(
  page: Page,
  theme: string,
  locale: string,
) {
  await page.addInitScript(
    ([theme, locale]) => {
      localStorage.setItem("vbs-theme", theme);
      localStorage.setItem("i18nextLng", locale);
    },
    [theme, locale] as const,
  );
}

// The nickname input is the one thing CreateSessionForm gives a stable,
// locale-independent handle (name="nickname") — every visible label is
// translated, so accessible-name lookups can't be reused across locales
// the way apps/web/e2e/helpers.ts's German-only createSession() does.
async function createSession(page: Page) {
  await page.goto("/");
  const nicknameInput = page.locator('input[name="nickname"]');
  await nicknameInput.fill("Ada");
  const form = page.locator("form").filter({ has: nicknameInput });
  await form.locator('button[type="submit"]').click();
  await page.waitForURL(/\/s\/[A-Z2-9]{12}#admin=[0-9a-f]{64}/);
  // Dismiss the one-time recovery dialog — its acknowledge button is
  // always the last of the dialog's two buttons, regardless of locale.
  await page.getByRole("dialog").getByRole("button").last().click();
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test.describe(`accessibility — ${theme} theme, ${locale} locale`, () => {
      test("home route", async ({ page }) => {
        await primeThemeAndLocale(page, theme, locale);
        await page.goto("/");
        await expectNoViolations(page);
      });

      test("session route", async ({ page }) => {
        await primeThemeAndLocale(page, theme, locale);
        await createSession(page);
        await expectNoViolations(page);
      });
    });
  }
}
