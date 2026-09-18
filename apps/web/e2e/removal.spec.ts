import { expect, test } from "@playwright/test";
import { createSession, heading, join } from "./helpers";

test("the admin removes a player mid-vote, and the removed player lands on their own screen without reloading", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const admin = await contextA.newPage();
  const bob = await contextB.newPage();

  const { code } = await createSession(admin, "Ada");
  await join(bob, code, "Bob");

  await admin.getByLabel("Story").fill("Removal check");
  await admin.getByRole("button", { name: "[ Runde starten ]" }).click();
  await expect(bob.getByText("Story: Removal check")).toBeVisible();
  await bob.getByRole("radio", { name: "5", exact: true }).click();

  const bobRow = admin
    .getByRole("listitem")
    .filter({ hasText: "Bob" })
    .first();
  await bobRow.getByRole("button", { name: "[ Entfernen ]" }).click();
  await expect(admin.getByText("Bob wirklich entfernen?")).toBeVisible();
  await admin.getByRole("button", { name: "[ Ja, entfernen ]" }).click();

  // No bob.reload(): the realtime session_changed broadcast is what has to
  // drive this — the session_state refetch it triggers is where Bob learns
  // he's no longer a member.
  await expect(heading(bob, "Das hat nicht geklappt")).toBeVisible({
    timeout: 5_000,
  });
  await expect(bob.getByRole("alert")).toContainText("entfernt");

  // Bob's earlier vote stays in the round for the admin to see.
  await admin.getByRole("button", { name: "[ Karten aufdecken ]" }).click();
  await expect(
    admin.getByRole("region", { name: "Ergebnis" }).getByText("5"),
  ).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("the admin cannot remove themselves", async ({ page }) => {
  await createSession(page, "Ada");

  const adminRow = page.getByRole("listitem").filter({ hasText: "Ada" });
  await expect(
    adminRow.getByRole("button", { name: "[ Entfernen ]" }),
  ).toBeHidden();
});

test("the admin leaving hands the chair to the next participant without a reload", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const admin = await contextA.newPage();
  const bob = await contextB.newPage();

  const { code } = await createSession(admin, "Ada");
  await join(bob, code, "Bob");

  await admin.getByRole("button", { name: "[ Sitzung verlassen ]" }).click();
  await expect(admin.getByText("Sitzung wirklich verlassen?")).toBeVisible();
  await admin.getByRole("button", { name: "[ Ja, verlassen ]" }).click();
  await expect(heading(admin, "Neue Sitzung eröffnen")).toBeVisible();

  // Bob is promoted without a reload and now sees the admin-only story form.
  await expect(bob.getByLabel("Story")).toBeVisible({ timeout: 5_000 });

  await contextA.close();
  await contextB.close();
});
