import { apiRequests, campaignUrl, expect, test, warbandStat } from "../fixtures/app";

/**
 * E2E-01 step 4: the hire dialog's Recruit as, on the seed's untouched warband.
 *
 * What it catches: the server's hire price not reaching the gold (the tally shows one number and
 * the warband keeps another), a fighter hired without his template's profile or free dagger, and a
 * Recruit that leaves the roster where it was. The cost rule is the server's; the test only checks
 * that what the dialog promises is what the warband ends up with.
 */
test("recruiting a captain from the template costs the warband what the tally says", async ({
  seed,
  signIn,
  problems,
}) => {
  const page = await signIn("fresh");

  // The request budget for a cold warband page (TEST_PLAN "Warband page after the layout"). 10 is
  // what it costs today, with `trade-requests/` asked for twice; lower this with the fix, never
  // raise it to make a change fit.
  const requests = await apiRequests(page, async () => {
    await page.goto(campaignUrl(seed, "/warband"));
    await expect(warbandStat(page, "Gold")).toHaveText(`${seed.fresh_gold} gc`);
    await page.getByRole("button", { name: "Add hero" }).waitFor();
  });
  expect(requests.length, requests.join(", ")).toBeLessThanOrEqual(10);
  for (const path of new Set(requests)) {
    expect(requests.filter((seen) => seen === path).length, path).toBeLessThanOrEqual(2);
  }

  await page.getByRole("button", { name: "Add hero" }).click();
  await expect(page.getByText("Recruit as")).toBeVisible();
  await page.getByText("Mercenary Captain").first().click();

  await page.locator('input[id$="-name"]').fill("Gerta Vogel");

  const tally = page.getByText(/^Gold \d+ → \d+ gc$/);
  await expect(tally).toBeVisible();
  const left = (await tally.innerText()).match(/→ (\d+) gc/)?.[1];
  expect(left).toBeDefined();
  expect(Number(left)).toBeLessThan(seed.fresh_gold);

  await page.getByRole("button", { name: "Recruit", exact: true }).click();

  await expect(warbandStat(page, "Gold")).toHaveText(`${left} gc`);
  await expect(warbandStat(page, "Units")).toContainText("1");
  // his template's profile came with him: a Mercenary Captain is WS 4
  await expect(page.getByRole("textbox", { name: "WS for Gerta Vogel" })).toHaveValue("4");
  expect(problems).toEqual([]);
});
