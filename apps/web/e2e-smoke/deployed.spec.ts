import { expect, test } from "@playwright/test";

// A full create/join/vote/reveal walkthrough can't run unattended against a
// Turnstile-protected deployment: Cloudflare's anti-bot challenge is
// designed specifically to not resolve for a headless, scripted browser —
// confirmed empirically (the sign-in step hangs indefinitely on "Bitte
// bestätige, dass du kein Bot bist."). That's Turnstile working as
// intended, not a bug to route around. Full functional coverage lives in
// CI's Playwright suite instead, where Turnstile stays unset (CLAUDE.md's
// Captcha section). This checks what's left that's still meaningful without
// signing in: the app boots and serves correctly, and Supabase itself is
// reachable.
test("the deployed app boots without crashing", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  // AuthGate wraps the entire app, so nothing else renders until sign-in
  // resolves — either the captcha prompt (Turnstile configured) or the real
  // home screen (sign-in completed immediately, e.g. no site key set).
  // Either proves the bundle loaded and rendered without crashing.
  await expect(
    page
      .getByText("Bitte bestätige, dass du kein Bot bist.")
      .or(page.getByRole("heading", { name: "Neue Sitzung eröffnen" })),
  ).toBeVisible({ timeout: 15_000 });
});

test("Supabase Auth is reachable", async ({ request }) => {
  const supabaseUrl = process.env["SMOKE_SUPABASE_URL"];
  const anonKey = process.env["SMOKE_SUPABASE_ANON_KEY"];
  test.skip(
    !supabaseUrl || !anonKey,
    "SMOKE_SUPABASE_URL/SMOKE_SUPABASE_ANON_KEY not set",
  );

  // A permission-denied response from a real table would still prove the
  // REST API is up (RLS working as designed, not a failure) — but that
  // makes it a poor health signal either way. /auth/v1/settings returns a
  // plain 200 with no auth beyond the public anon key, so a non-2xx here
  // means Auth itself is actually down or misconfigured.
  const settings = await request.get(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: anonKey! },
  });
  expect(settings.ok()).toBe(true);

  const body = await settings.json();
  expect(body).toHaveProperty("external");
});
