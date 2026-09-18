import { expect, test } from "@playwright/test";
import { createSession, join } from "../e2e/helpers";

// Safe to run against production after every deploy: creates its own
// session, votes, reveals, then has both participants leave so the session
// is deleted (an admin leaving with nobody else present ends the session
// outright — CLAUDE.md's "Removing and leaving" section) rather than
// lingering for up to 24h.
test("create, join, vote, and reveal on a live deployment", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const admin = await contextA.newPage();
  const bob = await contextB.newPage();

  try {
    const { code } = await createSession(admin, "Smoke-Admin");
    await join(bob, code, "Smoke-Bob");

    await admin.getByLabel("Story").fill("Smoke test");
    await admin.getByRole("button", { name: "[ Runde starten ]" }).click();
    await expect(bob.getByText("Story: Smoke test")).toBeVisible();

    await admin.getByRole("radio", { name: "5", exact: true }).click();
    await bob.getByRole("radio", { name: "8", exact: true }).click();

    await admin.getByRole("button", { name: "[ Karten aufdecken ]" }).click();
    const resultPanel = admin.getByRole("region", { name: "Ergebnis" });
    await expect(resultPanel).toBeVisible();
    await expect(
      bob.getByRole("region", { name: "Ergebnis" }),
    ).toBeVisible();
  } finally {
    await bob.getByRole("button", { name: "[ Sitzung verlassen ]" }).click();
    await bob.getByRole("button", { name: "[ Ja, verlassen ]" }).click();

    await admin.getByRole("button", { name: "[ Sitzung verlassen ]" }).click();
    await admin.getByRole("button", { name: "[ Ja, verlassen ]" }).click();

    await contextA.close();
    await contextB.close();
  }
});
