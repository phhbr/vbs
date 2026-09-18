import { expect, type Page } from "@playwright/test";

export function heading(page: Page, name: string) {
  return page.getByRole("heading", { name });
}

export async function createSession(page: Page, nickname: string) {
  await page.goto("/");
  await page.getByLabel("Dein Name").fill(nickname);
  await page.getByRole("button", { name: "[ Sitzung eröffnen ]" }).click();
  await page.waitForURL(/\/s\/[A-Z2-9]{12}#admin=[0-9a-f]{64}/);

  const url = new URL(page.url());
  return {
    code: url.pathname.split("/").pop()!,
    recoveryUrl: page.url(),
  };
}

export async function join(page: Page, code: string, nickname: string) {
  await page.goto(`/s/${code}`);
  await page.getByLabel("Dein Name").fill(nickname);
  await page.getByRole("button", { name: "[ Beitreten ]" }).click();
  await expect(heading(page, "Vorzimmer")).toBeVisible();
}
