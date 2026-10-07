import { expect, test } from "@playwright/test";
import { createSession, join } from "./helpers";

// Polling runs every 4 s and the notice appears after 10 s without a
// socket, so assertions on the blocked side need more than the default 5 s.
const POLLED = { timeout: 15_000 };

test("a participant whose network blocks WebSockets still follows the round", async ({
  browser,
}) => {
  test.setTimeout(90_000);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  // The same failure a corporate proxy with a "Block WebSockets" rule
  // produces: every plain HTTPS request goes through, every Realtime socket
  // is shut the moment it opens.
  await contextB.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) =>
    ws.close(),
  );
  const admin = await contextA.newPage();
  const bob = await contextB.newPage();

  const { code } = await createSession(admin, "Ada");
  await join(bob, code, "Bob");

  await expect(bob.getByText("Keine Live-Verbindung")).toBeVisible(POLLED);
  await expect(admin.getByText("Verbunden")).toBeVisible();

  await admin.getByRole("textbox", { name: "Story" }).fill("Proxy story");
  await admin.getByRole("button", { name: "Runde starten" }).click();

  // No broadcast can reach Bob — only polling can deliver this.
  await expect(bob.getByText("Proxy story").first()).toBeVisible(POLLED);

  // Bob never appears in socket presence, but his heartbeats reach Ada's
  // screen through session_state: up to one 4 s heartbeat plus one 10 s
  // presence-gap recheck.
  const bobOnAdmin = admin
    .getByRole("list", { name: "Abstimmungsstatus" })
    .getByRole("listitem")
    .filter({ hasText: "Bob" });
  await expect(bobOnAdmin).toBeVisible();
  await expect(bobOnAdmin).not.toContainText("offline", { timeout: 20_000 });

  // Without presence, Bob's view cannot know who is online, so it must not
  // claim that anyone is offline.
  const bobList = bob.getByRole("list", { name: "Abstimmungsstatus" });
  await expect(
    bobList.getByRole("listitem").filter({ hasText: "Ada" }),
  ).not.toContainText("offline");

  await bob.getByRole("radio", { name: "5", exact: true }).click();
  await admin.getByRole("radio", { name: "8", exact: true }).click();

  // Bob's vote reaches the admin over the admin's own, working socket.
  await expect(
    admin
      .getByRole("list", { name: "Abstimmungsstatus" })
      .getByRole("listitem")
      .filter({ hasText: "Bob" }),
  ).toContainText("hat abgestimmt");
  // And Ada's own, so the reveal is not an early one that asks first.
  await expect(
    admin.getByText("Abstimmung läuft — 2 von 2 abgegeben.").first(),
  ).toBeVisible();

  await admin.getByRole("button", { name: "Karten aufdecken" }).click();

  // (5 + 8) / 2 = 6.5, arriving at Bob by polling alone.
  await expect(
    bob.getByRole("region", { name: "Ergebnis" }).getByText("6.5"),
  ).toBeVisible(POLLED);

  await contextA.close();
  await contextB.close();
});

test("an admin whose network blocks WebSockets sees their own reveal at once", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => ws.close());
  const admin = await context.newPage();

  await createSession(admin, "Ada");
  await admin.getByRole("textbox", { name: "Story" }).fill("Own reveal");
  await admin.getByRole("button", { name: "Runde starten" }).click();
  await admin.getByRole("radio", { name: "5", exact: true }).click();
  await expect(
    admin.getByText("Abstimmung läuft — 1 von 1 abgegeben.").first(),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Karten aufdecken" }).click();

  // Shorter than one 4 s poll tick: the reveal's own refetch has to bring
  // the result in, not the next poll. Before every mutation refreshed all
  // session data, only the round status was refetched, and the result
  // panel kept saying "voting" until a broadcast — which never comes here.
  await expect(
    admin
      .getByRole("region", { name: "Ergebnis" })
      .getByRole("list", { name: "Stimmverteilung" }),
  ).toContainText("5: 1 Stimme, Ada", { timeout: 1_500 });

  await context.close();
});
