/**
 * The Wargear table as the app mounts it (layout, fake server): one row per availability, the
 * name cell holding only the name whatever the row is (CAT-UX-01), each phone row's availability
 * under its name (CAT-UX-03), and one Acquire dialog mounted per row (PERF-48).
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import { routeCatalogue } from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

/** Counts mounts of the Acquire dialog, which every Wargear row renders (PERF-48). */
const acquire = vi.hoisted(() => ({ mounts: 0 }));
vi.mock(
  "@/features/items/components/AcquireItemDialog/AcquireItemDialog",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/items/components/AcquireItemDialog/AcquireItemDialog")
      >();
    const React = await import("react");
    function CountedAcquireItemDialog(props: Parameters<typeof actual.default>[0]) {
      React.useEffect(() => {
        acquire.mounts += 1;
      }, []);
      return React.createElement(actual.default, props);
    }
    return { ...actual, default: CountedAcquireItemDialog };
  }
);

const rows = (name: string) => screen.getAllByRole("button", { name: new RegExp(`^${name}`) });
const row = (name: string) => rows(name)[0];
/** The cells of a row (its first cell is the expand chevron). */
const cells = (element: HTMLElement) =>
  [...element.querySelectorAll("td")].map((cell) => cell.textContent);

async function openWargear() {
  renderCatalogueRoute("/campaigns/1/items");
  await screen.findByRole("button", { name: /^Rusty Cleaver/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  media.mobile = false;
  acquire.mounts = 0;
  routeCampaignShell();
  routeCatalogue();
});

describe("Wargear: what a row says", () => {
  // Characterises current behaviour (CAT-UX-01, CAT-NEW-03, pinned; flips in PR C)
  it("gives a campaign item, a book item and a house rule's clone the same bare name cell (CAT-UX-01, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await openWargear();

    expect(cells(row("Axe"))[1]).toBe("Axe");
    expect(cells(row("Rusty Cleaver"))[1]).toBe("Rusty Cleaver");
    expect(cells(row("Sword"))[1]).toBe("Sword");
    await user.click(screen.getByRole("button", { name: "Armour" }));
    expect(cells(row("Heavy Armour"))[1]).toBe("Heavy Armour");
    expect(row("Heavy Armour")).toHaveTextContent(/Common\s*25/);
    expect(within(screen.getByRole("table")).queryByText(/custom|house rule/i)).toBeNull();
  });

  it("shows one row per availability on desktop, each with its restriction, rarer first", async () => {
    await openWargear();

    const [rare, common] = rows("Blowpipe");
    expect(rows("Blowpipe")).toHaveLength(2);
    expect(rare).toHaveTextContent("Lizardmen, Skaven");
    expect(rare).toHaveTextContent(/Skaven\s*7\s*25/);
    expect(common).toHaveTextContent("Forest Goblins");
    expect(common).toHaveTextContent(/Common\s*25/);
  });

  it("shows each availability's restriction and rarity under the name on a phone, so look-alike rows differ (CAT-UX-03, CAT-TEST-19)", async () => {
    const user = setupUser();
    media.mobile = true;
    await openWargear();

    const [rare, common] = rows("Blowpipe");
    expect(cells(rare).slice(1, 3)).toEqual(["BlowpipeLizardmen, Skaven · Rare 7", "25"]);
    expect(cells(common).slice(1, 3)).toEqual(["BlowpipeForest Goblins · Common", "25"]);
    expect(within(rare).getByText("Lizardmen, Skaven · Rare 7")).toBeVisible();
    // An item anyone may buy shows its rarity alone.
    expect(cells(row("Sword"))[1]).toBe("SwordCommon");

    await user.click(common);
    expect(
      within(screen.getByText("Forest Goblins").closest("td")!).getByText("Restricted to")
    ).toBeVisible();
  });
});

describe("Wargear: Acquire dialogs", () => {
  // Characterises current behaviour (PERF-48, CAT-PERF-06, pinned; flips in PR B)
  it("mounts one Acquire dialog per row, and more for each tab's rows (PERF-48, pinned; flips in PR B)", async () => {
    const user = setupUser();
    await openWargear();

    // Weapons: Axe, Rusty Cleaver, Sword and Blowpipe's two rows.
    expect(screen.getAllByRole("button", { name: /^Acquire .*weapon$/ })).toHaveLength(5);
    expect(acquire.mounts).toBe(5);

    await user.click(screen.getByRole("button", { name: "Armour" }));
    expect(acquire.mounts).toBe(6);
  });
});
