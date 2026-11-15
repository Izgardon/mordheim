import { campaignUrl, expect, test, warbandStat } from "../fixtures/app";

/**
 * E2E-01 steps 1-3, as far as the seed takes them: a player who is in the campaign but has no
 * warband signs in and raises one.
 *
 * What it catches: a sign-in that no longer reaches the app (tokens, the boot screen, the
 * campaigns redirect), a raise screen that can't pick a warband type, and a warband that is not
 * given its template's starting gold — the gold every later decision is spent from.
 */
test("a player with no warband signs in and raises one at its template's starting gold", async ({
  seed,
  signIn,
  problems,
}) => {
  const page = await signIn("newcomer");

  await page.goto(campaignUrl(seed, "/warband"));
  await expect(page.getByText("Raise a warband")).toBeVisible();

  await page.getByRole("textbox").first().fill("Night Lanterns");
  await page.getByRole("combobox", { name: "Warband type" }).click();
  await page.getByRole("option", { name: /^Reiklanders/ }).first().click();
  await page.getByRole("button", { name: "Raise the warband" }).click();

  await expect(page.getByRole("heading", { name: "Night Lanterns" })).toBeVisible();
  // The Reiklanders' book starting gold, pinned here rather than read from the seed: a test that
  // compares the app with itself would pass whatever the template said.
  await expect(warbandStat(page, "Gold")).toHaveText("500 gc");
  await expect(warbandStat(page, "Units")).toContainText("0");
  expect(problems).toEqual([]);
});
