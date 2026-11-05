/**
 * Raising a warband shows its type's template in outline (the templates plan, "Raise a warband,
 * a 450 gc campaign"): the gold it gets, its most warriors, each fighter's cost and how many, the
 * rule pills, and a variant to pick when the type presets none. Nothing is hired here.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { RaiseOutline } from "../../types/hire-template-types";
import type { WarbandTypeRow } from "../../types/warband-types";
import CreateWarband from "./CreateWarband";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const caravans: WarbandTypeRow = {
  id: 7,
  name: "Merchant Caravans",
  slug: "merchant-caravans",
  campaign_id: null,
  setting: { id: 1, slug: "mordheim-1b", name: "Mordheim 1b", grade: "1b" },
  source: "Town Cryer",
  link_url: "",
  groups: [],
  race: "",
  source_code: "TC",
  broheim_grade: "1b",
  mordheimer_grade: "core",
  in_play: true,
};

vi.mock("../../api/warband-types-queries", () => ({
  useWarbandTypes: () => ({ data: [caravans], isLoading: false }),
  useAddWarbandType: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const fighter = (key: string, kind: "hero" | "henchman", name: string, cost: number) => ({
  key,
  kind,
  name,
  plural: kind === "henchman" ? `${name}s` : "",
  cost,
  min_count: 0,
  max_count: kind === "hero" ? 2 : null,
  group_min: kind === "hero" ? null : 1,
  group_max: kind === "hero" ? null : 5,
});

const outline = (extra: Partial<NonNullable<RaiseOutline["template"]>>): RaiseOutline => ({
  template: {
    id: 3,
    name: "Merchant Caravans",
    variants: [],
    preset_variant: "",
    variant: "",
    rules: [{ id: 1, title: "Trade", description: "Buy low." }],
    fighters: [
      fighter("merchant", "hero", "Merchant", 50),
      fighter("sell-swords", "henchman", "Sell-sword", 25),
    ],
    ...extra,
  },
  gold: 550,
  campaign_gold: 450,
  book_gold: 600,
  most_warriors: 12,
});

const OUTLINE = "GET /campaigns/4/warband-types/7/template/";

async function pickType() {
  const user = setupUser();
  await user.type(screen.getByLabelText("Name"), "The Gilded Wagon");
  await user.type(screen.getByRole("combobox", { name: "Warband type" }), "Merch");
  await user.click(screen.getByRole("option", { name: /Merchant Caravans/ }));
  return user;
}

describe("Raising a warband from its type's template", () => {
  beforeEach(() => fakeApi.reset());

  it("outlines the template and raises with nothing hired", async () => {
    fakeApi.on(OUTLINE, outline({}));
    fakeApi.on("POST /warbands/", { id: 11, name: "The Gilded Wagon" });
    const onCreated = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<CreateWarband campaignId={4} onCreated={onCreated} />);
    const user = await pickType();

    const shown = await screen.findByRole("region", { name: "Template outline" });
    expect(within(shown).getByText("550 gc")).toBeInTheDocument();
    expect(within(shown).getByText("12")).toBeInTheDocument();
    expect(
      within(shown).getByText(
        "The campaign's 450, plus 100: Merchant Caravans start on 600 in the book."
      )
    ).toBeInTheDocument();
    expect(within(shown).getByText("Merchant")).toBeInTheDocument();
    expect(within(shown).getByText("0–2")).toBeInTheDocument();
    expect(within(shown).getByText("any · groups of 1–5")).toBeInTheDocument();
    expect(within(shown).getByRole("button", { name: "Trade" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Raise the warband" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(fakeApi.bodyOf("POST /warbands/")).toEqual({
      name: "The Gilded Wagon",
      warband_type_id: 7,
      warband_link: null,
      campaign_id: 4,
    });
  });

  it("fills the link from the type with no note saying so", async () => {
    caravans.link_url = "https://mordheimer.net/caravans";
    try {
      fakeApi.on(OUTLINE, outline({}));
      renderWithQueryClient(<CreateWarband campaignId={4} onCreated={vi.fn()} />);
      await pickType();
      expect(screen.getByLabelText("Warband link")).toHaveValue("https://mordheimer.net/caravans");
      expect(screen.queryByText(/Filled from/)).toBeNull();
    } finally {
      caravans.link_url = "";
    }
  });

  it("asks for a variant when the type presets none, and sends it", async () => {
    const variants = [
      { key: "norse", name: "The Norse" },
      { key: "hung", name: "The Hung" },
    ];
    fakeApi.on(OUTLINE, outline({ variants }));
    fakeApi.on(`${OUTLINE}?variant=hung`, outline({ variants, variant: "hung" }));
    fakeApi.on("POST /warbands/", { id: 11, name: "The Gilded Wagon" });
    renderWithQueryClient(<CreateWarband campaignId={4} onCreated={vi.fn()} />);
    const user = await pickType();

    const picker = await screen.findByRole("radiogroup", { name: "Variant" });
    expect(
      within(picker)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-checked"))
    ).toEqual(["false", "false"]);
    expect(screen.getByRole("button", { name: "Raise the warband" })).toBeDisabled();
    await user.click(within(picker).getByRole("radio", { name: "The Hung" }));
    await user.click(await screen.findByRole("button", { name: "Raise the warband" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/")).toMatchObject({ template_variant: "hung" })
    );
  });

  it("waits for the outline before Raise, which says whether a variant is needed", async () => {
    fakeApi.on("POST /warbands/", { id: 11, name: "The Gilded Wagon" });
    renderWithQueryClient(<CreateWarband campaignId={4} onCreated={vi.fn()} />);
    await pickType(); // the outline never answers
    expect(screen.getByRole("button", { name: "Raise the warband" })).toBeDisabled();
  });

  it("shows no outline for a type with no template", async () => {
    fakeApi.on(OUTLINE, { template: null, gold: 500, campaign_gold: 500, most_warriors: 15 });
    renderWithQueryClient(<CreateWarband campaignId={4} onCreated={vi.fn()} />);
    await pickType();
    await waitFor(() => expect(fakeApi.countOf(OUTLINE)).toBe(1));
    expect(screen.queryByRole("region", { name: "Template outline" })).not.toBeInTheDocument();
  });
});
