import { expect, test } from "@playwright/test";
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

  await admin.getByLabel("Story").fill("Login redesign");
  await admin.getByRole("button", { name: "[ Runde starten ]" }).click();

  // The story reaches both players through realtime, with no reload.
  await expect(admin.getByText("Story: Login redesign")).toBeVisible();
  await expect(bob.getByText("Story: Login redesign")).toBeVisible();
  await expect(cy.getByText("Story: Login redesign")).toBeVisible();

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
  await admin.getByRole("button", { name: "[ Karten aufdecken ]" }).click();

  // (5 + 8 + 13) / 3 = 8.6666… → 8.7, no consensus, spread 5–13.
  await expect(admin.getByText("Ø Durchschnitt")).toBeVisible();
  await expect(admin.getByText("8.7")).toBeVisible();
  await expect(admin.getByText("Streuung: 5 – 13")).toBeVisible();

  // All three see the same result, again with no reload.
  await expect(bob.getByText("8.7")).toBeVisible();
  await expect(cy.getByText("8.7")).toBeVisible();
  await expect(bobStatus).toContainText("5");
  await expect(cyStatus).toContainText("8");

  await admin.getByRole("button", { name: "[ Neu schätzen ]" }).click();

  // A fresh attempt at the same story: votes are cleared for everyone.
  await expect(admin.getByText("Story: Login redesign")).toBeVisible();
  await expect(bobStatus).toContainText("wartet");
  await expect(cyStatus).toContainText("wartet");
  await expect(admin.getByText("Ø Durchschnitt")).toBeHidden();

  // The earlier round and its result stay in the database as history —
  // covered at the data layer by 080_rpc_voting.sql, since M3 has no
  // dedicated history view yet to assert against here.

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
