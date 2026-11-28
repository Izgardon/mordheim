import { campaignUrl, expect, test, warbandStat } from "../fixtures/app";

/**
 * E2E-01 steps 8-9 on the battle the seed parks in the post-game: the owner walks his aftermath
 * and presses Ready.
 *
 * What it catches: the one-shot the app is least able to lose — finalise. The Ready dialog states
 * what the warband will hold afterwards, so the test reads that number and asserts the warband
 * ends up with it. A finalise that charges a different upkeep, charges it twice, or leaves the
 * aftermath open afterwards fails here.
 */
test("the owner finishes his post-game and the warband holds what the Ready dialog promised", async ({
  seed,
  signIn,
  problems,
}) => {
  const page = await signIn("owner");
  await page.goto(campaignUrl(seed, `/battles/${seed.battles.postbattle}/postbattle`));
  await expect(page.getByText("After battle")).toBeVisible();

  await page.getByRole("button", { name: /^Next: Experience$/ }).click();
  await page.getByRole("button", { name: /^Next: Explore$/ }).click();
  await page.getByRole("link", { name: "Ready", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Ready for the next battle?")).toBeVisible();
  const promised = (await dialog.innerText()).match(/(\d+) → (\d+) gc/);
  expect(promised, "the Ready dialog states the gold after upkeep").not.toBeNull();
  const [, before, after] = promised!;

  await expect(warbandStat(page, "Gold")).toHaveText(`${before} gc`);
  await dialog.getByRole("button", { name: "Ready", exact: true }).click();

  await expect(warbandStat(page, "Gold")).toHaveText(`${after} gc`);
  await expect(page.getByText("To the aftermath")).toHaveCount(0);
  expect(problems).toEqual([]);
});
