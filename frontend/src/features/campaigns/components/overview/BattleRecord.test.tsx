/**
 * The Battles page's open battle (William, 7 Nov 2026: "battles: just do put out of action, can
 * then also show what happened to units in that battle after if they got injuries or died"): turn
 * by turn, each unit put out of action and by whom, with the turn's moments; then After, each
 * warband's serious injuries and deaths. The overview's rows keep opening to their moments only.
 */
import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_ID } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import type {
  BattleRecord,
  CampaignBattleHistoryEntry,
  CampaignBattleMoment,
} from "../../types/campaign-types";
import BattleRows from "./BattleRows";
import { aftermathText, recordGroups } from "./overview-data";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const moment = (id: number, round: number | null, tag: string): CampaignBattleMoment => ({
  id,
  kind: "first_blood",
  headline: tag === "Result" ? "Wiped Out" : "First Blood",
  detail: tag === "Result" ? "The Rats were wiped out." : "Ott drew first blood.",
  round,
  tag,
  warband_id: 1,
  warband_name: "Black Eagles",
  unit: null,
});
const battle: CampaignBattleHistoryEntry = {
  id: 6,
  scenario: "Street Fight",
  winners: ["Black Eagles"],
  date: "01/11/26",
  participants: [],
  moments: [moment(1, 1, "Turn 1"), moment(2, null, "Result")],
};
const out = (name: string, warband: string, by: string | null = null) => ({
  name,
  warband_id: warband ? 2 : null,
  warband_name: warband,
  by,
});
const record: BattleRecord = {
  rounds: [
    { round: 1, out_of_action: [out("Tisk", "Rats", "Ott the Red"), out("Snik", "Rats")] },
    { round: 2, out_of_action: [out("Zombie 1", "", "Hans")] },
  ],
  aftermath: [
    {
      warband_id: 2,
      warband_name: "Rats",
      units: [
        {
          name: "Tisk",
          unit_kind: "hero",
          group_name: "",
          results: ["Nervous Condition"],
          dead: false,
        },
        {
          name: "Snik",
          unit_kind: "henchman",
          group_name: "Verminkin",
          results: ["Dead"],
          dead: true,
        },
      ],
    },
  ],
};
const RECORD = `GET /campaigns/${CAMPAIGN_ID}/battle-history/6/record/`;

const show = (withRecord: boolean) =>
  renderWithQueryClient(
    <MemoryRouter>
      <BattleRows
        battles={[battle]}
        campaignId={CAMPAIGN_ID}
        isMobile={false}
        record={withRecord}
      />
    </MemoryRouter>
  );

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(RECORD, record);
});

describe("The Battles page's open battle", () => {
  it("lists each turn's units out of action, by whom, then After's injuries and deaths", async () => {
    show(true);

    const turn1 = (await screen.findByText("Turn 1")).parentElement as HTMLElement;
    expect(turn1).toHaveTextContent("Tisk taken out by Ott the Red · Rats");
    expect(turn1).toHaveTextContent("Snik out of action · Rats");
    expect(turn1).toHaveTextContent("First Blood");
    const turn2 = screen.getByText("Turn 2").parentElement as HTMLElement;
    expect(turn2).toHaveTextContent("Zombie 1 taken out by Hans · Neutral");
    const after = screen.getByText("After").parentElement as HTMLElement;
    expect(within(after).getByText("Rats")).toBeInTheDocument();
    expect(after).toHaveTextContent("Tisk: Nervous Condition");
    expect(after).toHaveTextContent("Snik (Verminkin): Dead");
    expect(after).toHaveTextContent("Wiped Out");
  });

  it("is the overview's moments only, without the record", async () => {
    show(false);

    expect(await screen.findByText("Turn 1")).toBeInTheDocument();
    expect(screen.queryByText(/out of action/)).toBeNull();
    expect(fakeApi.calls()).not.toContain(RECORD);
  });
});

describe("recordGroups", () => {
  it("orders the turns, puts a kill logged after the fight under During, and the rest After", () => {
    const during = moment(3, null, "During");
    const groups = recordGroups({ rounds: record.rounds, aftermath: [] }, [
      moment(4, 3, "Turn 3"),
      during,
    ]);
    expect(groups.map((group) => group.label)).toEqual(["Turn 1", "Turn 2", "Turn 3", "During"]);
    expect(recordGroups({ rounds: [], aftermath: [] }, [])).toEqual([]);
  });

  it("says Dead once for a unit that died", () => {
    const unit = record.aftermath[0].units[1];
    expect(aftermathText(unit)).toBe("Dead");
    expect(aftermathText({ ...unit, results: ["Survives"] })).toBe("Survives, Dead");
  });
});
