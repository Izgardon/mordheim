/**
 * Recruiting is an inline form at the top of its roster section (William, 1 Nov 2026: "an inline
 * form rather than a modal ... it should then automatically start in the edit mode after saving"),
 * and a hire or a camp recruit lands on the new card in Edit through `?unit=…&edit=1`.
 */
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import type { WarbandHero } from "../../types/warband-types";
import RosterSections from "./RosterSections";
import { unitName } from "./unit-view";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

// the page reads the roster from the sheet's cache; here the cache update feeds the harness
let pushHeroes: (heroes: WarbandHero[]) => void = () => undefined;
vi.mock("../../api/warband-cache", () => ({
  useWarbandCacheUpdate: () => (_id: number, update: { heroes?: WarbandHero[] }) =>
    update.heroes ? pushHeroes(update.heroes) : undefined,
}));

const aldric = makeHero({ id: 5, name: "Aldric Voss" });
const ulrich = makeHero({ id: 6, name: "Ulrich Brandt", unit_type: "Champion", price: 35 });

function Harness() {
  const [heroes, setHeroes] = useState<WarbandHero[]>([aldric]);
  pushHeroes = setHeroes;
  return (
    <RosterSections
      warbandId={9}
      campaign={null}
      heroes={heroes}
      henchmenGroups={[]}
      hirelings={[]}
      resources={[]}
      canEdit
      canCreateRace={false}
      onLoadout={vi.fn()}
      onHire={vi.fn()}
      onAdvance={vi.fn()}
      onBuyAgain={vi.fn()}
      renderEdit={(entry) => <p>Editing {unitName(entry.unit)}</p>}
    />
  );
}

const renderAt = (url = "/campaigns/1/warband") =>
  renderWithQueryClient(
    <MemoryRouter initialEntries={[url]}>
      <Harness />
    </MemoryRouter>
  );

describe("Recruiting from the roster", () => {
  beforeEach(() => fakeApi.reset());

  it("opens the form in the Heroes section, and the new hero's card opens in Edit", async () => {
    fakeApi.on("POST /warbands/9/heroes/batch/", {
      units: [aldric, ulrich],
      summary: {},
      warnings: [],
    });
    renderAt();
    const user = setupUser();
    const heroes = screen.getByRole("region", { name: "Heroes" });
    await user.click(within(heroes).getByRole("button", { name: "Add hero" }));

    const form = within(heroes).getByRole("form", { name: "Recruit" });
    expect(within(form).getByLabelText("Name")).toHaveFocus();
    await user.type(within(form).getByLabelText("Name"), "Ulrich Brandt");
    await user.type(within(form).getByLabelText("Type"), "Champion");
    await user.type(within(form).getByLabelText("Cost (gc)"), "35");
    await user.click(within(form).getByRole("button", { name: "Recruit" }));

    expect(await screen.findByText("Editing Ulrich Brandt")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /warbands/9/heroes/batch/")).toEqual({
      create: [{ name: "Ulrich Brandt", unit_type: "Champion", race: null, price: 35, xp: 0 }],
    });
    expect(screen.queryByRole("form", { name: "Recruit" })).not.toBeInTheDocument();
  });

  it("keeps the form when the recruit fails, and Cancel closes it", async () => {
    fakeApi.fail("POST /warbands/9/heroes/batch/");
    renderAt();
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Add hero" }));
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/heroes/batch/")).toBe(1));
    expect(screen.getByRole("form", { name: "Recruit" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Recruit" })).not.toBeInTheDocument();
  });

  it("opens a linked card straight in Edit (after a hire or a camp recruit)", () => {
    renderAt("/campaigns/1/warband?unit=hero-5&edit=1");
    expect(screen.getByText("Editing Aldric Voss")).toBeInTheDocument();
  });

  it("opens the hire form for someone not in the list in Hired swords", () => {
    renderAt("/campaigns/1/warband?recruit=hireling");
    const hired = screen.getByRole("region", { name: "Hired swords" });
    expect(
      within(hired).getByRole("form", { name: "Hire someone not in the list" })
    ).toBeInTheDocument();
    expect(within(hired).getByText("Hire fee paid")).toBeInTheDocument();
  });
});
