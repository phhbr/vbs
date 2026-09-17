import { expect, test, type Page } from "@playwright/test";

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { name });

async function createSession(page: Page, nickname: string) {
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

async function join(page: Page, code: string, nickname: string) {
  await page.goto(`/s/${code}`);
  await page.getByLabel("Dein Name").fill(nickname);
  await page.getByRole("button", { name: "[ Beitreten ]" }).click();
  await expect(heading(page, "Vorzimmer")).toBeVisible();
}

test("two people share a session by link and both see each other", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const { code } = await createSession(pageA, "Ada");
  await expect(heading(pageA, "Vorzimmer")).toBeVisible();
  await expect(pageA.getByRole("listitem")).toHaveCount(1);

  await join(pageB, code, "Bob");
  await expect(pageB.getByRole("listitem")).toHaveCount(2);

  // No realtime yet, so A picks the change up on the manual refresh.
  await pageA.getByRole("button", { name: "[Aktualisieren]" }).click();
  await expect(pageA.getByRole("listitem")).toHaveCount(2);
  await expect(pageA.getByRole("listitem").nth(0)).toContainText("Ada");
  await expect(pageA.getByRole("listitem").nth(1)).toContainText("Bob");

  await contextA.close();
  await contextB.close();
});

test("the recovery link makes a third browser the admin and demotes the first", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  const { code, recoveryUrl } = await createSession(pageA, "Ada");
  await join(pageB, code, "Bob");

  // The recovery link is shown exactly once, with its warning.
  await expect(heading(pageA, "Wiederherstellungs-Link")).toBeVisible();
  await expect(pageA.getByRole("alert")).toContainText("genau einmal");

  await pageA.getByRole("button", { name: "[ Verstanden, weiter ]" }).click();
  await expect(heading(pageA, "Wiederherstellungs-Link")).toBeHidden();
  // Acknowledging strips the token from the URL.
  expect(new URL(pageA.url()).hash).toBe("");

  // C is a stranger to the session and recovers the chair with the link.
  await pageC.goto(recoveryUrl);
  await expect(heading(pageC, "Vorzimmer")).toBeVisible();
  await expect(pageC.getByRole("status")).toContainText("übernommen");
  // The token never survives in the address bar.
  expect(new URL(pageC.url()).hash).toBe("");

  // C adopted Ada's row rather than adding a ghost participant.
  await expect(pageC.getByRole("listitem")).toHaveCount(2);
  await expect(pageC.getByRole("listitem").nth(0)).toContainText("Ada");
  await expect(pageC.getByRole("listitem").nth(0)).toContainText("admin");
  await expect(pageC.getByRole("listitem").nth(0)).toContainText("du");

  // A lost the session with the row, so A is no longer a member of it.
  await pageA.reload();
  await expect(heading(pageA, "Sitzung beitreten")).toBeVisible();

  // B is unaffected and still sees exactly one admin.
  await pageB.getByRole("button", { name: "[Aktualisieren]" }).click();
  await expect(pageB.getByRole("listitem")).toHaveCount(2);
  await expect(
    pageB.getByRole("listitem").filter({ hasText: "admin" }),
  ).toHaveCount(1);

  await contextA.close();
  await contextB.close();
  await contextC.close();
});

test("a wrong recovery token lands on the error screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Dein Name").fill("Ada");
  await page.getByRole("button", { name: "[ Sitzung eröffnen ]" }).click();
  await page.waitForURL(/\/s\/[A-Z2-9]{12}/);
  const code = new URL(page.url()).pathname.split("/").pop()!;

  await page.goto(`/s/${code}#admin=${"f".repeat(64)}`);
  await expect(heading(page, "Das hat nicht geklappt")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("ungültig");
});

test("an unknown code and a taken nickname each get a way forward", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const { code } = await createSession(pageA, "Ada");

  await pageB.goto(`/s/${code}`);
  await pageB.getByLabel("Dein Name").fill("ada");
  await pageB.getByRole("button", { name: "[ Beitreten ]" }).click();
  await expect(pageB.getByRole("alert")).toContainText("gibt es hier schon");

  await pageB.goto("/s/MMMMMMMMMMMM");
  await expect(heading(pageB, "Das hat nicht geklappt")).toBeVisible();
  await expect(pageB.getByRole("alert")).toContainText("Code kennen wir nicht");
  await pageB.getByRole("link", { name: "[ Zurück zum Anfang ]" }).click();
  await expect(heading(pageB, "Neue Sitzung eröffnen")).toBeVisible();

  await contextA.close();
  await contextB.close();
});
