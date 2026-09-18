import { expect, type Page } from "@playwright/test";

export function heading(
  page: Page,
  name: string,
  options?: { exact?: boolean },
) {
  return page.getByRole("heading", { name, ...options });
}

export async function createSession(page: Page, nickname: string) {
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

export async function join(page: Page, code: string, nickname: string) {
  await page.goto(`/s/${code}`);
  await page.getByLabel("Dein Name").fill(nickname);
  await page.getByRole("button", { name: "[ Beitreten ]" }).click();
  await expect(heading(page, "Sitzung", { exact: true })).toBeVisible();
}

// The local stack's keys are the same fixed demo values on every machine
// (see the CI workflow's comment on .env.example), so hardcoding the
// service-role key here is not a leaked secret — it's how tests reach past
// RLS to set up state a real client never could, such as backdating a
// session's expiry instead of waiting 24 hours for one. Never used by
// application code, only by test tooling (architecture rule 5 is about the
// frontend bundle, which this file is not part of).
const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export async function backdateExpiry(code: string, expiresAt: Date) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?code=eq.${code}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ expires_at: expiresAt.toISOString() }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `backdateExpiry failed: ${response.status} ${await response.text()}`,
    );
  }
}
