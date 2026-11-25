/**
 * The roster's sections on a phone (William, 25 Nov 2026): "change the add hero/henchmen
 * group/hired sword to just a plus button. For henchmen let's just say how many groups. Then to
 * the right of these plus buttons let's have an expand arrow and let each section be expandable
 * and minimisable, always fully expanded when navigating to the page."
 */
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHenchmenGroup, makeHero } from "@/test/warband-fixtures";

import type { HenchmenGroup } from "../../types/warband-types";
import RosterSections from "./RosterSections";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));
const media = vi.hoisted(() => ({ phone: true }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.phone }));

const NO_TEMPLATE = { template: null, variant: "", list_prices_open: true };

const renderRoster = ({
  canEdit = true,
  groups = [makeHenchmenGroup({ id: 21, warband_id: 9 })],
} = {}) => {
  const onHire = vi.fn();
  renderWithQueryClient(
    <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
      <RosterSections
        warbandId={9}
        campaign={null}
        heroes={[makeHero({ id: 5, name: "Konrad Adler" })]}
        henchmenGroups={groups as HenchmenGroup[]}
        hirelings={[]}
        canEdit={canEdit}
        canCreateRace={false}
        onLoadout={vi.fn()}
        onHire={onHire}
        onAdvance={vi.fn()}
        onBuyAgain={vi.fn()}
        renderEdit={() => null}
      />
    </MemoryRouter>
  );
  return { onHire };
};
const section = (name: string) => screen.getByRole("region", { name });

describe("The roster's sections on a phone", () => {
  beforeEach(() => {
    media.phone = true;
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", NO_TEMPLATE);
  });

  it("adds with a plus in each section, which opens what the old buttons did", async () => {
    const { onHire } = renderRoster();
    const user = setupUser();

    await user.click(within(section("Heroes")).getByRole("button", { name: "Add hero" }));
    expect(await screen.findByRole("dialog", { name: "Add a hero" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(
      within(section("Henchmen")).getByRole("button", { name: "Add henchmen group" })
    );
    expect(await screen.findByRole("dialog", { name: "Add a group" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(
      within(section("Hired swords")).getByRole("button", { name: "Hire a hired sword" })
    );
    expect(onHire).toHaveBeenCalledTimes(1);
    // the plus holds only its icon: no visible "Add hero" words
    expect(screen.queryByText("Add hero")).toBeNull();
  });

  it("shows no plus to a reader who can't add", () => {
    renderRoster({ canEdit: false });
    for (const name of ["Add hero", "Add henchmen group", "Hire a hired sword"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Heroes" })).toBeInTheDocument();
  });

  it("says how many groups only, one group in the singular", () => {
    renderRoster();
    expect(within(section("Henchmen")).getByText("1 group")).toBeInTheDocument();
    expect(screen.queryByText(/models/)).toBeNull();
  });

  it("counts groups in the plural", () => {
    renderRoster({
      groups: [makeHenchmenGroup({ id: 21 }), makeHenchmenGroup({ id: 22, name: "Rats" })],
    });
    expect(within(section("Henchmen")).getByText("2 groups")).toBeInTheDocument();
  });

  it("starts with every section open, and folds one away with its chevron", async () => {
    renderRoster();
    const user = setupUser();
    for (const name of ["Heroes", "Henchmen", "Hired swords"]) {
      const toggle = within(section(name)).getByRole("button", { name });
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).toBeVisible();
    }

    const heroes = section("Heroes");
    const toggle = within(heroes).getByRole("button", { name: "Heroes" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(heroes).queryByRole("article")).toBeNull();
    expect(within(section("Henchmen")).getAllByRole("article")).toHaveLength(1);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(heroes).getAllByRole("article")).toHaveLength(1);
  });

  it("still adds from a folded section", async () => {
    renderRoster();
    const user = setupUser();
    const heroes = section("Heroes");
    await user.click(within(heroes).getByRole("button", { name: "Heroes" }));
    await user.click(within(heroes).getByRole("button", { name: "Add hero" }));
    expect(await screen.findByRole("dialog", { name: "Add a hero" })).toBeInTheDocument();
  });
});

describe("The roster's sections on the web", () => {
  beforeEach(() => {
    media.phone = false;
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", NO_TEMPLATE);
  });

  it("keeps the worded buttons, the models count and no chevrons", () => {
    renderRoster();
    expect(screen.getByRole("button", { name: "Add hero" })).toHaveTextContent("Add hero");
    expect(screen.getByRole("button", { name: "Add group" })).toHaveTextContent("Add group");
    expect(screen.getByRole("button", { name: "Hire" })).toHaveTextContent("Hire");
    expect(screen.getByText("1 group · 0 models")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Heroes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Henchmen" })).toBeNull();
  });
});
