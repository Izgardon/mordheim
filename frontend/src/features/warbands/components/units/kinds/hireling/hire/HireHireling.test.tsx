/**
 * Hiring on the warband page (the bestiary rewrite's step 2): one Hire button beside Edit Hired
 * Swords opens two lists, the campaign's hired swords and dramatis personae. Picking one asks for
 * a name and `POST warbands/<id>/hirelings/hire/` does the rest on the server; the answer joins the
 * roster, the fee's gold is read again, and the server's warnings show. The hired-sword cap greys
 * out the hired swords only. Hand-typed hirelings still go through Edit Hired Swords.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppToaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api-client";
import { HIRED_SWORDS, LIST, bertha } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { humanRace, makeVeteranHireling } from "@/test/warband-fixtures";

import UnitSection from "../../../UnitSection";
import { WarbandCatalogueContext, type WarbandCatalogue } from "../../../catalogue-context";
import { useUnitSectionEditor } from "../../../../../hooks/units/useUnitSectionEditor";
import { hirelingKind } from "../../../../../units/kinds/hireling";
import { takesHiredSwordPlace } from "../../../../../units/kinds/hireling-terms";

import type { WarbandHireling } from "../../../../../types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));
vi.mock("@/features/campaigns/hooks/useCampaignStarted", () => ({
  useCampaignStarted: () => true,
}));

const HIRE = "POST /warbands/9/hirelings/hire/";

const catalogue: WarbandCatalogue = {
  campaignId: 1,
  availableItems: [],
  availableSkills: [],
  availableSpells: [],
  availableSpecials: [],
  availableRaces: [humanRace],
  itemsError: "",
  skillsError: "",
  spellsError: "",
  specialsError: "",
  racesError: "",
  isItemsLoading: false,
  isSkillsLoading: false,
  isSpellsLoading: false,
  isSpecialsLoading: false,
  isRacesLoading: false,
  canAddCustom: false,
  onRaceCreated: vi.fn(),
};

/** The Ogre Bodyguard as the hire answers him: the detail, named Grukk. */
const grukk = makeVeteranHireling({
  id: 77,
  name: "Grukk",
  unit_type: "Ogre Bodyguard",
  kind: "hired_sword",
  price: 80,
  upkeep_price: 30,
});
const hiredBertha = makeVeteranHireling({
  id: 78,
  name: "Bertha Bestraufrung",
  unit_type: "Bertha Bestraufrung",
  kind: "dramatis_persona",
  injury_table: "hero",
  stays: "one_battle",
  payment_note: "25 gc or 1 shard",
  no_level_ups: true,
});

function Section({
  initialHirelings = [],
  maxHiredSwords = 3,
  canEdit = true,
}: {
  initialHirelings?: WarbandHireling[];
  maxHiredSwords?: number;
  canEdit?: boolean;
}) {
  const [hirelings, setHirelings] = useState(initialHirelings);
  const editor = useUnitSectionEditor(hirelingKind, {
    warbandId: 9,
    units: hirelings,
    canEdit,
    roster: {
      maxHeroes: 6,
      maxHiredSwords,
      heroCount: 0,
      hirelingCount: hirelings.filter(takesHiredSwordPlace).length,
    },
    onUnitsChange: setHirelings,
  });
  return (
    <MemoryRouter>
      <WarbandCatalogueContext.Provider value={catalogue}>
        <UnitSection
          editor={editor}
          units={hirelings}
          warbandId={9}
          canEdit={canEdit}
          availableGold={200}
        />
      </WarbandCatalogueContext.Provider>
      <AppToaster />
    </MemoryRouter>
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Hire" });
const entry = (name: string) =>
  within(dialog()).getByRole("button", { name: new RegExp(`^${name}`) });

async function openHire(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole("button", { name: "Hire" }));
  await within(dialog()).findByRole("button", { name: /^Ogre Bodyguard/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(LIST.hiredSwords, HIRED_SWORDS);
  fakeApi.on(LIST.dramatisPersonae, [bertha]);
  fakeApi.on("GET /warbands/9/summary/", { gold: 120 });
});

describe("Hire", () => {
  it("hires a hired sword on the server: picked from the list, named, POSTed with its source and id, and on the roster", async () => {
    const user = setupUser();
    fakeApi.on(HIRE, { ...grukk, warnings: [] });
    renderWithQueryClient(<Section />);

    await openHire(user);
    expect(entry("Ogre Bodyguard")).toHaveTextContent("Ogre · Hire 80 gc · Upkeep 30 gc");
    await user.click(entry("Ogre Bodyguard"));
    expect(within(dialog()).getByText("Costs 80 gc, leaving 120 gc.")).toBeVisible();
    expect(within(dialog()).getByText("Upkeep after each battle: 30 gc")).toBeVisible();
    const name = within(dialog()).getByLabelText("Name");
    expect(name).toHaveValue("Ogre Bodyguard");
    await user.clear(name);
    await user.type(name, "Grukk");
    await user.click(within(dialog()).getByRole("button", { name: "Hire Grukk" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fakeApi.bodyOf(HIRE)).toEqual({ source: "hired_sword", id: 17, name: "Grukk" });
    expect(screen.getByText("Grukk")).toBeVisible();
    expect(await screen.findByText("Grukk joins the warband.")).toBeVisible();
    // One hire, no client-side copy: no batch, no create.
    expect(fakeApi.calls().filter((call) => call.startsWith("POST"))).toEqual([HIRE]);
  });

  it("hires a dramatis persona from the second list, whose fee isn't gold, showing his terms", async () => {
    const user = setupUser();
    fakeApi.on(HIRE, { ...hiredBertha, warnings: [] });
    renderWithQueryClient(<Section />);

    await openHire(user);
    await user.click(within(dialog()).getByRole("button", { name: "Dramatis personae" }));
    await user.click(await within(dialog()).findByRole("button", { name: /^Bertha Bestraufrung/ }));
    expect(
      within(dialog()).getByText("Fee: 2 Treasure. It isn't gold, so no gold is taken.")
    ).toBeVisible();
    expect(within(dialog()).getByText("One battle · Paid in 25 gc or 1 shard")).toBeVisible();
    await user.click(within(dialog()).getByRole("button", { name: "Hire Bertha Bestraufrung" }));

    await waitFor(() => expect(fakeApi.countOf(HIRE)).toBe(1));
    expect(fakeApi.bodyOf(HIRE)).toEqual({
      source: "dramatis_persona",
      id: 60,
      name: "Bertha Bestraufrung",
    });
    expect(await screen.findByText("Dramatis persona")).toBeVisible();
  });

  it("says so when the catalogue holds no dramatis personae, with the way to add one", async () => {
    const user = setupUser();
    fakeApi.on(LIST.dramatisPersonae, []);
    renderWithQueryClient(<Section />);

    await openHire(user);
    await user.click(within(dialog()).getByRole("button", { name: "Dramatis personae" }));

    const empty = await within(dialog()).findByText(/No dramatis personae in the catalogue yet/);
    expect(within(empty).getByRole("link", { name: "Dramatis Personae" })).toHaveAttribute(
      "href",
      "/campaigns/1/dramatis-personae"
    );
  });

  it("reads each list once, when the dialog first shows it", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section />);
    expect(fakeApi.countOf(LIST.hiredSwords)).toBe(0);

    await openHire(user);
    await user.click(within(dialog()).getByRole("button", { name: "Dramatis personae" }));
    await within(dialog()).findByRole("button", { name: /^Bertha/ });
    await user.click(within(dialog()).getByRole("button", { name: "Hired swords" }));
    await within(dialog()).findByRole("button", { name: /^Ogre Bodyguard/ });

    expect(fakeApi.countOf(LIST.hiredSwords)).toBe(1);
    expect(fakeApi.countOf(LIST.dramatisPersonae)).toBe(1);
  });

  it("marks a dramatis persona already in the warband, and shows the server's warning when he is hired again", async () => {
    const user = setupUser();
    const warning =
      "Bertha Bestraufrung is already in this warband: a dramatis persona is one of each.";
    fakeApi.on(HIRE, {
      ...hiredBertha,
      id: 79,
      warnings: [{ code: "dramatis_persona_already_hired", message: warning, id: 78 }],
    });
    renderWithQueryClient(<Section initialHirelings={[hiredBertha]} />);

    await openHire(user);
    await user.click(within(dialog()).getByRole("button", { name: "Dramatis personae" }));
    const row = await within(dialog()).findByRole("button", { name: /^Bertha Bestraufrung/ });
    expect(row).toHaveTextContent("Already in your warband");
    await user.click(row);
    await user.click(within(dialog()).getByRole("button", { name: "Hire Bertha Bestraufrung" }));

    expect(await screen.findByText(warning)).toBeVisible();
    // Both copies are on the roster: a warning, never a block.
    await waitFor(() => expect(screen.getAllByText("Dramatis persona")).toHaveLength(2));
  });

  it("shows the server's warning when the entry was archived or removed for the campaign", async () => {
    const user = setupUser();
    const warning = "Ogre Bodyguard is archived in this campaign's catalogue; it was hired anyway.";
    fakeApi.on(HIRE, {
      ...grukk,
      warnings: [{ code: "archived_entry", message: warning, source: "hired_sword", id: 17 }],
    });
    renderWithQueryClient(<Section />);

    await openHire(user);
    await user.click(entry("Ogre Bodyguard"));
    await user.click(within(dialog()).getByRole("button", { name: "Hire Ogre Bodyguard" }));

    expect(await screen.findByText(warning)).toBeVisible();
  });

  it("greys out the hired swords at the cap and says why, while a dramatis persona can still be hired", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <Section initialHirelings={[makeVeteranHireling(), hiredBertha]} maxHiredSwords={1} />
    );

    await openHire(user);
    expect(within(dialog()).getByText(/Maximum of 1 hired swords reached/)).toBeVisible();
    expect(entry("Ogre Bodyguard")).toBeDisabled();
    await user.click(within(dialog()).getByRole("button", { name: "Dramatis personae" }));
    expect(await within(dialog()).findByRole("button", { name: /^Bertha/ })).toBeEnabled();
  });

  it("keeps a refused hire's reason in the dialog, which stays open", async () => {
    const user = setupUser();
    const detail = "Warband already has 1 hired swords";
    fakeApi.fail(
      HIRE,
      new ApiError(detail, 400, { detail, code: "hired_sword_cap_reached", fields: {} })
    );
    renderWithQueryClient(<Section />);

    await openHire(user);
    await user.click(entry("Pit Fighter"));
    await user.click(within(dialog()).getByRole("button", { name: "Hire Pit Fighter" }));

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText("Pit Fighter joins the warband.")).toBeNull();
  });

  it("offers Hire only to an editor, and not during an edit, where Add hired sword types one by hand", async () => {
    const user = setupUser();
    const { unmount } = renderWithQueryClient(<Section canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Hire" })).toBeNull();
    unmount();

    renderWithQueryClient(<Section initialHirelings={[makeVeteranHireling()]} />);
    await user.click(screen.getAllByRole("button", { name: "Edit Hired Swords" })[0]);

    expect(screen.queryByRole("button", { name: "Hire" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    expect(screen.getByRole("group", { name: "New Hired Sword" })).toBeVisible();
    expect(screen.queryByText(/preset/i)).toBeNull();
  });
});
