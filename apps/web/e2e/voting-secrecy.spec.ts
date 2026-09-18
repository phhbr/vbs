import { expect, test, type WebSocket } from "@playwright/test";
import { createSession, join } from "./helpers";

/**
 * The non-negotiable rule for M3: a vote value must never leave the database
 * before its round is revealed — not in a realtime payload. Broadcasts carry
 * only sessions.version (see broadcast_session_version() in the realtime
 * migration); round data travels over plain HTTPS RPC calls, never the
 * socket. This test captures every frame of a player's websocket for the
 * whole session and asserts neither other participant's distinctive vote
 * value ever appears in one — a strictly stronger guarantee than "before
 * reveal", so it also catches a regression that leaked values only after.
 */
test("no vote value ever appears in a player's realtime frames", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const admin = await contextA.newPage();
  const bob = await contextB.newPage();
  const cy = await contextC.newPage();

  const frames: string[] = [];
  bob.on("websocket", (ws: WebSocket) => {
    ws.on("framereceived", (event) => frames.push(String(event.payload)));
    ws.on("framesent", (event) => frames.push(String(event.payload)));
  });

  const { code } = await createSession(admin, "Ada");
  await join(bob, code, "Bob");
  await join(cy, code, "Cy");

  await admin.getByLabel("Story").fill("Login redesign");
  await admin.getByRole("button", { name: "[ Runde starten ]" }).click();
  await expect(bob.getByText("Story: Login redesign")).toBeVisible();

  // Distinctive fibonacci values, unlikely to collide with a small
  // sessions.version counter or a coincidental hex run in a session id.
  await admin.getByRole("radio", { name: "100", exact: true }).click();
  await cy.getByRole("radio", { name: "40", exact: true }).click();

  await expect(
    admin
      .getByRole("list", { name: "Abstimmungsstatus" })
      .getByRole("listitem")
      .filter({ hasText: "Cy" }),
  ).toContainText("hat abgestimmt");

  await admin.getByRole("button", { name: "[ Karten aufdecken ]" }).click();
  // Confirms Bob actually received the reveal over the socket, so the
  // capture window covers the moment values became public knowledge too.
  await expect(bob.getByText("Ø Durchschnitt")).toBeVisible();

  expect(frames.length).toBeGreaterThan(0);
  // The capture must have caught real traffic, or the assertion below would
  // pass vacuously.
  expect(frames.some((frame) => frame.includes("session_changed"))).toBe(
    true,
  );

  for (const frame of frames) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame);
    } catch {
      continue;
    }
    // Phoenix channel wire format: [join_ref, ref, topic, event, payload].
    // Index 2 (topic) legitimately contains the session's uuid, which is not
    // a secret — only the event payload itself must never carry a vote
    // value, so that's the only slice checked here.
    const payload = Array.isArray(parsed) ? parsed[4] : parsed;
    const payloadText = JSON.stringify(payload ?? null);
    expect(payloadText).not.toContain('"100"');
    expect(payloadText).not.toContain('"40"');
  }

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
