import { expect, test } from "@playwright/test";
import { backdateExpiry, createSession } from "./helpers";

test("the expiry warning appears once a session is within the last hour", async ({
  page,
}) => {
  const { code } = await createSession(page, "Ada");
  const warning = page.getByRole("status").filter({ hasText: "Achtung" });
  await expect(warning).toBeHidden();

  // A direct SQL backdate bypasses touch_session/broadcast entirely — there
  // is no realtime signal for it, unlike a real approaching expiry — so a
  // reload is what stands in for time actually passing.
  await backdateExpiry(code, new Date(Date.now() + 30 * 60 * 1000));
  await page.reload();

  await expect(warning).toBeVisible();
  await expect(warning).toContainText("24 Stunden");
});
