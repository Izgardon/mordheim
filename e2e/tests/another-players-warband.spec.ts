import { campaignUrl, expect, test } from "../fixtures/app";

/**
 * E2E-07 steps 1-2, the first test with two players in it at once: one opens the other's warband.
 *
 * What it catches: the rule that the UI never shows an action the server will reject, in both
 * directions. If a capability flag stops reaching the roster, the Edit and Add controls come back
 * for a reader; if a permission check is dropped on the server, the hand-made request succeeds.
 * Either half failing alone is a real defect, so the test asserts both.
 */
test("a player sees another warband without its controls, and the server refuses him anyway", async ({
  seed,
  signIn,
  problems,
}) => {
  const owner = await signIn("owner");
  const other = await signIn("player");
  const ownersWarband = seed.users.owner.warband_id;

  await owner.goto(campaignUrl(seed, "/warband"));
  await expect(owner.getByRole("button", { name: "Add hero" })).toBeVisible();

  await other.goto(campaignUrl(seed, `/warbands/${ownersWarband}`));
  await expect(other.getByRole("heading", { name: "Steel Vigil" })).toBeVisible();
  await expect(other.getByRole("button", { name: "Add hero" })).toHaveCount(0);
  await expect(other.getByRole("button", { name: "Add group" })).toHaveCount(0);

  const token = await other.evaluate(() => window.localStorage.getItem("mordheim_token"));
  const refused = await other.request.post(`/api/warbands/${ownersWarband}/item-sales/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { source: "stash", item_id: 1, quantity: 1 },
  });
  expect(refused.status()).toBe(403);
  expect(problems).toEqual([]);
});
