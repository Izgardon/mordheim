import { describe, expect, it } from "vitest";

import type { CampaignBattleMoment } from "../../types/campaign-types";
import { momentGroups, momentParts } from "./overview-data";

const moment = (fields: Partial<CampaignBattleMoment> = {}): CampaignBattleMoment => ({
  id: 1,
  kind: "hero_slayer",
  headline: "Hero Slayer",
  detail: "Kurt took Magister Halvard out of action.",
  round: 2,
  tag: "Turn 2",
  warband_id: 3,
  warband_name: "Grey Order",
  unit: { kind: "henchmen_group", id: 7, name: "Kurt" },
  ...fields,
});

describe("momentGroups", () => {
  it("groups the moments by their tag, in the server's order", () => {
    const moments = [
      moment({ id: 1, tag: "Turn 1" }),
      moment({ id: 2, tag: "Turn 2" }),
      moment({ id: 3, tag: "Turn 2" }),
      moment({ id: 4, tag: "Result", round: null, unit: null }),
    ];

    expect(momentGroups(moments).map((group) => [group.label, group.moments.length])).toEqual([
      ["Turn 1", 1],
      ["Turn 2", 2],
      ["Result", 1],
    ]);
    expect(momentGroups(undefined)).toEqual([]);
  });
});

describe("momentParts", () => {
  it("finds the unit's name in the detail, so the row can link it", () => {
    expect(momentParts(moment())).toEqual({
      before: "",
      name: "Kurt",
      after: " took Magister Halvard out of action.",
    });
    const lone = moment({ detail: "Aldric was the last of Reikland standing.", unit: null });
    expect(momentParts(lone)).toBeNull();
    const elsewhere = moment({ detail: "Somebody else did it." });
    expect(momentParts(elsewhere)).toBeNull();
  });
});
