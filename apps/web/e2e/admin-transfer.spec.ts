import { expect, test } from "@playwright/test";
import { createSession, join } from "./helpers";

test("the admin hands the chair to a player, and both screens follow without a reload", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const ada = await contextA.newPage();
  const bob = await contextB.newPage();

  const { code } = await createSession(ada, "Ada");
  await join(bob, code, "Bob");

  const startButton = (page: typeof ada) =>
    page.getByRole("button", { name: "Runde starten" });
  await expect(startButton(ada)).toBeVisible();
  await expect(startButton(bob)).toBeHidden();

  const bobRow = ada.getByRole("listitem").filter({ hasText: "Bob" }).first();
  await bobRow.getByRole("button", { name: "Leitung übergeben" }).click();
  await expect(
    ada.getByText("Leitung an Bob übergeben?", { exact: false }),
  ).toBeVisible();
  await ada.getByRole("button", { name: "Ja, übergeben" }).click();

  // The admin controls move: Bob gains them through the broadcast, Ada
  // loses them through her own mutation's refresh.
  await expect(startButton(bob)).toBeVisible();
  await expect(startButton(ada)).toBeHidden();

  // Bob, now in the chair, can hand it back — Ada's row carries the
  // control on his screen, and his own row no longer does.
  const adaRowOnBob = bob
    .getByRole("listitem")
    .filter({ hasText: "Ada" })
    .first();
  await expect(
    adaRowOnBob.getByRole("button", { name: "Leitung übergeben" }),
  ).toBeVisible();
  await expect(
    ada.getByRole("button", { name: "Leitung übergeben" }),
  ).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});
