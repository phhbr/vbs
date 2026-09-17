import { expect, test } from "@playwright/test";

test("home route renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Vorgangsbewertungsstelle")).toBeVisible();
});

test("session route renders with the code from the URL", async ({ page }) => {
  await page.goto("/s/ABCD-1234");
  await expect(page.getByText("ABCD-1234")).toBeVisible();
});
