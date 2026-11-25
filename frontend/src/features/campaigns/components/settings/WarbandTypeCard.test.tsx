/**
 * Settings → Warband type: a new variant (or type) swaps the warband's rules on the server
 * (William, 25 Nov 2026), whose words on what changed are shown after the save, while the warband
 * page's rules pills take its rules as they now stand and the battle Rules sheet's copy reads again.
 */
import { screen } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type { Warband } from "@/features/warbands/types/warband-types";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import WarbandTypeCard from "./WarbandTypeCard";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const mercenaries = {
  id: 3,
  name: "Mercenaries",
  slug: "mercenaries",
  campaign_id: null,
  setting: null,
  source: "",
  link_url: "",
  groups: [],
};
const warband: Warband = {
  id: 9,
  name: "The Black Eagles",
  warband_type: mercenaries,
  counts_as: [],
  campaign_id: 7,
  user_id: 1,
  template_variant: "reikland",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const OUTLINE = {
  template: {
    id: 1,
    name: "Mercenaries",
    variants: [
      { key: "reikland", name: "Reikland" },
      { key: "middenheim", name: "Middenheim" },
    ],
    preset_variant: "",
    variant: "reikland",
    rules: [],
    fighters: [],
  },
  gold: 500,
  campaign_gold: 500,
  most_warriors: 15,
};
const NOW = [
  { id: 1, title: "Hard Bargains", description: "Haggle." },
  { id: 5, title: "Fury", description: "Ulric." },
];

describe("the warband's variant in Settings", () => {
  beforeEach(() => {
    fakeApi.reset();
    vi.mocked(toast).mockReset();
    fakeApi.on("GET /campaigns/7/warband-types/3/template/?variant=reikland", OUTLINE);
    fakeApi.on("GET /campaigns/7/warband-types/3/template/?variant=middenheim", OUTLINE);
  });

  it("shows the server's words on the rules it swapped and updates the rules pills", async () => {
    fakeApi.on("PATCH /warbands/9/", {
      ...warband,
      template_variant: "middenheim",
      rules_changed: {
        words: ["Added 1 rule and removed 1.", "Kept your edited rule: Discipline."],
        added: 1,
        removed: 1,
        kept: ["Discipline"],
        rules: NOW,
      },
    });
    const queryClient = createTestQueryClient();
    const sheetKey = queryKeys.campaign.warbandSheet(7, 9);
    queryClient.setQueryData(sheetKey, {
      warband,
      rules: [{ id: 2, title: "Marksmen", description: "" }],
    } as unknown as WarbandSheet);
    const rulesKey = queryKeys.campaign.warbandRules(7, 9);
    queryClient.setQueryData(rulesKey, []);
    const user = setupUser();
    renderWithQueryClient(<WarbandTypeCard warband={warband} canEdit onSaved={vi.fn()} />, {
      queryClient,
    });

    await user.click(await screen.findByRole("radio", { name: "Middenheim" }));

    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ template_variant: "middenheim" });
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Added 1 rule and removed 1.", {
        description: "Kept your edited rule: Discipline.",
      })
    );
    expect(queryClient.getQueryData<WarbandSheet>(sheetKey)?.rules).toEqual(NOW);
    expect(queryClient.getQueryState(rulesKey)?.isInvalidated).toBe(true);
  });

  it("shows nothing when the change left the rules alone", async () => {
    fakeApi.on("PATCH /warbands/9/", {
      ...warband,
      template_variant: "middenheim",
      rules_changed: { words: [], added: 0, removed: 0, kept: [], rules: [] },
    });
    const user = setupUser();
    const onSaved = vi.fn();
    renderWithQueryClient(<WarbandTypeCard warband={warband} canEdit onSaved={onSaved} />);

    await user.click(await screen.findByRole("radio", { name: "Middenheim" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });
});
