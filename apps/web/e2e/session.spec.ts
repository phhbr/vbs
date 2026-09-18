import { expect, test } from "@playwright/test";
import { createSession, heading, join } from "./helpers";

test("two people share a session by link and both see each other", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const { code } = await createSession(pageA, "Ada");
  await expect(heading(pageA, "Sitzung", { exact: true })).toBeVisible();
  await expect(pageA.getByRole("listitem")).toHaveCount(1);

  await join(pageB, code, "Bob");
  await expect(pageB.getByRole("listitem")).toHaveCount(2);

  // Realtime, not a manual refresh: A's own view updates on its own.
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

  await pageA.getByRole("button", { name: "Verstanden, weiter" }).click();
  await expect(heading(pageA, "Wiederherstellungs-Link")).toBeHidden();
  // Acknowledging strips the token from the URL.
  expect(new URL(pageA.url()).hash).toBe("");

  // C is a stranger to the session and recovers the chair with the link.
  await pageC.goto(recoveryUrl);
  await expect(heading(pageC, "Sitzung", { exact: true })).toBeVisible();
  await expect(pageC.getByRole("status")).toContainText("übernommen");
  // The token never survives in the address bar.
  expect(new URL(pageC.url()).hash).toBe("");

  // C adopted Ada's row rather than adding a ghost participant, and the
  // admin-only story form now renders for C — the participant list itself
  // no longer shows role labels (STYLE.md's team list never did either).
  await expect(pageC.getByRole("listitem")).toHaveCount(2);
  await expect(
    pageC.getByRole("listitem").filter({ hasText: "Ada" }),
  ).toContainText("du");
  await expect(pageC.getByRole("textbox", { name: "Story" })).toBeVisible();

  // A lost the session with the row, so A is no longer a member of it.
  await pageA.reload();
  await expect(heading(pageA, "Sitzung beitreten")).toBeVisible();

  // B is unaffected and still sees both participants — exactly one admin
  // is the database's invariant to keep, covered thoroughly at that layer
  // (010_session_codes_and_admin_invariant.sql); B never had the story
  // form either way, so it isn't a differential check here.
  await expect(pageB.getByRole("listitem")).toHaveCount(2);
  await expect(pageB.getByRole("textbox", { name: "Story" })).toBeHidden();

  await contextA.close();
  await contextB.close();
  await contextC.close();
});

test("a wrong recovery token lands on the error screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Dein Name").fill("Ada");
  await page.getByRole("button", { name: "Sitzung eröffnen" }).click();
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
  await pageB.getByRole("button", { name: "Beitreten" }).click();
  await expect(pageB.getByRole("alert")).toContainText("gibt es hier schon");

  await pageB.goto("/s/MMMMMMMMMMMM");
  await expect(heading(pageB, "Das hat nicht geklappt")).toBeVisible();
  await expect(pageB.getByRole("alert")).toContainText("Code kennen wir nicht");
  await pageB.getByRole("link", { name: "Zurück zum Anfang" }).click();
  await expect(heading(pageB, "Neue Sitzung eröffnen")).toBeVisible();

  await contextA.close();
  await contextB.close();
});
