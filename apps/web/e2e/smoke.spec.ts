import { expect, test } from "@playwright/test";

test("home route renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Vorgangsbewertungsstelle")).toBeVisible();
});

test("a malformed code in the URL resolves to the error screen", async ({
  page,
}) => {
  await page.goto("/s/ABCD-1234");
  await expect(
    page.getByRole("heading", { name: "Das hat nicht geklappt" }),
  ).toBeVisible();
});
