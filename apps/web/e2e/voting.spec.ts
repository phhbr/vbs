import { expect, type Page, test } from "@playwright/test";
import { createSession, join } from "./helpers";

test("start, vote, reveal and re-estimate across three participants", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const admin = await contextA.newPage();
  const bob = await contextB.newPage();
  const cy = await contextC.newPage();

  const { code } = await createSession(admin, "Ada");
  await join(bob, code, "Bob");
  await join(cy, code, "Cy");

  await admin.getByRole("textbox", { name: "Story" }).fill("Login redesign");
  await admin.getByRole("button", { name: "Runde starten" }).click();

  // The story reaches both players through realtime, with no reload.
  await expect(admin.getByText("Login redesign")).toBeVisible();
  await expect(bob.getByText("Login redesign")).toBeVisible();
  await expect(cy.getByText("Login redesign")).toBeVisible();

  await bob.getByRole("radio", { name: "5", exact: true }).click();
  await cy.getByRole("radio", { name: "8", exact: true }).click();

  const voteStatusList = admin.getByRole("list", {
    name: "Abstimmungsstatus",
  });
  const bobStatus = voteStatusList
    .getByRole("listitem")
    .filter({ hasText: "Bob" });
  const cyStatus = voteStatusList
    .getByRole("listitem")
    .filter({ hasText: "Cy" });

  // The admin learns who has voted, but never their values before reveal.
  await expect(bobStatus).toContainText("hat abgestimmt");
  await expect(cyStatus).toContainText("hat abgestimmt");
  await expect(bobStatus).not.toContainText("5");
  await expect(cyStatus).not.toContainText("8");

  await admin.getByRole("radio", { name: "13", exact: true }).click();
  // Wait for Ada's own vote to count: revealing at 2 of 3 would ask for
  // confirmation first (early reveal) instead of revealing.
  await expect(
    admin.getByText("Abstimmung läuft — 3 von 3 abgegeben.").first(),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Karten aufdecken" }).click();

  // (5 + 8 + 13) / 3 = 8.6666… → 8.7, no consensus, spread 5–13.
  // The result panel specifically — "Ø Durchschnitt" alone would also match
  // the recent-rounds preview, which shows the same result a second time.
  const resultPanel = admin.getByRole("region", { name: "Ergebnis" });
  await expect(resultPanel.getByText("Ø Durchschnitt:")).toBeVisible();
  await expect(resultPanel.getByText("8.7")).toBeVisible();
  await expect(resultPanel.getByText("Streuung: 5 – 13")).toBeVisible();

  // All three see the same result, again with no reload.
  await expect(
    bob.getByRole("region", { name: "Ergebnis" }).getByText("8.7"),
  ).toBeVisible();
  await expect(
    cy.getByRole("region", { name: "Ergebnis" }).getByText("8.7"),
  ).toBeVisible();
  await expect(bobStatus).toContainText("5");
  await expect(cyStatus).toContainText("8");

  await admin.getByRole("button", { name: "Neu schätzen" }).click();

  // A fresh attempt at the same story: votes are cleared for everyone.
  // Scoped to the round's status bar — the history preview shows the same
  // story name too, which would otherwise be ambiguous.
  await expect(
    admin
      .getByRole("group", { name: "Rundenstatus" })
      .getByText("Login redesign"),
  ).toBeVisible();
  await expect(bobStatus).toContainText("wartet");
  await expect(cyStatus).toContainText("wartet");
  await expect(resultPanel.getByText("Ø Durchschnitt:")).toBeHidden();

  // The earlier round and its result stay in the database as history, and
  // now visibly so too: the recent-rounds preview keeps it after re-estimate
  // starts a fresh, empty round.
  await expect(
    admin.getByText("Login redesign — Ø Durchschnitt 8.7"),
  ).toBeVisible();

  await contextA.close();
  await contextB.close();
  await contextC.close();
});

test("the admin reveals early after confirming, and the result groups voters by card", async ({
  browser,
}) => {
  const names = ["Bob", "Cy", "Dee"];
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const { code } = await createSession(admin, "Ada");
  const players = await Promise.all(
    names.map(async () => (await browser.newContext()).newPage()),
  );
  for (const [i, page] of players.entries()) await join(page, code, names[i]!);
  const [bob, cy, dee] = players as [Page, Page, Page];

  await admin.getByRole("textbox", { name: "Story" }).fill("Grouping");
  await admin.getByRole("button", { name: "Runde starten" }).click();
  await expect(bob.getByText("Grouping").first()).toBeVisible();

  await bob.getByRole("radio", { name: "3", exact: true }).click();
  await cy.getByRole("radio", { name: "3", exact: true }).click();
  await dee.getByRole("radio", { name: "8", exact: true }).click();
  await expect(
    admin.getByText("Abstimmung läuft — 3 von 4 abgegeben.").first(),
  ).toBeVisible();

  // Ada has not voted: revealing asks first, and cancelling changes nothing.
  await admin.getByRole("button", { name: "Karten aufdecken" }).click();
  await expect(
    admin.getByText("Erst 3 von 4 haben abgestimmt — trotzdem aufdecken?"),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Abbrechen" }).click();
  await expect(
    admin.getByRole("button", { name: "Karten aufdecken" }),
  ).toBeVisible();

  await admin.getByRole("button", { name: "Karten aufdecken" }).click();
  await admin.getByRole("button", { name: "Ja, aufdecken" }).click();

  // Bob's screen, by broadcast: card 3 first (deck order), then 8.
  const result = bob.getByRole("region", { name: "Ergebnis" });
  const groups = result
    .getByRole("list", { name: "Stimmverteilung" })
    .getByRole("listitem");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toContainText("2 Stimmen");
  await expect(groups.nth(0)).toContainText("Bob und Cy");
  await expect(groups.nth(1)).toContainText("1 Stimme");
  await expect(groups.nth(1)).toContainText("Dee");
  await expect(result.getByText("Nicht abgestimmt: Ada")).toBeVisible();
  await expect(
    result.getByText("Streuung: 3 – 8", { exact: false }),
  ).toBeVisible();

  await adminContext.close();
  for (const page of players) await page.context().close();
});
