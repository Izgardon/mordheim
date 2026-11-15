import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { seed as readSeed, type Seed } from "./seed";

/**
 * What every spec starts from: a signed-in page per player, and the page's own record of anything
 * that went wrong in the browser while the test ran.
 *
 * `signIn` opens a context of its own for each player, so a test can hold two players at once, and
 * only starts watching the console once the app is up: the landing page's background video is
 * fetched from an outside host a test machine need not be able to reach.
 */
export type AppFixtures = {
  seed: Seed;
  signIn: (handle: string) => Promise<Page>;
  /** Console errors and 5xx answers seen since each player signed in. */
  problems: string[];
};

export const test = base.extend<AppFixtures>({
  seed: async ({}, use) => {
    await use(readSeed());
  },
  problems: async ({}, use) => {
    await use([]);
  },
  signIn: async ({ browser, seed, problems }, use) => {
    const contexts: BrowserContext[] = [];
    const signIn = async (handle: string) => {
      const user = seed.users[handle];
      if (!user) throw new Error(`No seeded player called ${handle}`);
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await page.goto("/");
      await page.getByLabel("Email").fill(user.email);
      await page.getByRole("textbox", { name: "Password" }).fill(seed.password);
      await page.locator("form").getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/campaigns/);
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`${user.email} console: ${message.text()}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 500) problems.push(`${user.email} ${response.status()} ${response.url()}`);
      });
      return page;
    };
    await use(signIn);
    for (const context of contexts) await context.close();
  },
});

export { expect };

/** The campaign's own URLs, which every spec navigates by id rather than by clicking to. */
export function campaignUrl(seed: Seed, path = ""): string {
  return `/campaigns/${seed.campaign.id}${path}`;
}

/** The warband header's Gold, Rating, Units or Record cell ("Gold" -> "440 gc"). */
export function warbandStat(page: Page, label: string) {
  return page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
    .locator("dd")
    .first();
}

/** The `/api/` paths a page asked for while `action` ran: the request-budget fixture (T0-8). */
export async function apiRequests(page: Page, action: () => Promise<void>): Promise<string[]> {
  const paths: string[] = [];
  const listen = (request: { url: () => string }) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) paths.push(url.pathname);
  };
  page.on("request", listen);
  try {
    await action();
  } finally {
    page.off("request", listen);
  }
  return paths;
}
