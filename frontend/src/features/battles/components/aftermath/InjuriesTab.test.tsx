import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  BattlePostbattleRules,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";
import { postbattleRules } from "@/test/battle-fixtures";

import InjuriesTab from "./InjuriesTab";

const robbed = {
  roll_type: "d66",
  rolls: [3, 6],
  result_code: "36",
  result_label: "Robbed",
  dead_suggestion: false,
  effect: { kind: "manual" },
} as const;

const draft = {
  unit_results: {
    "hero:1": {
      unit_name: "Dieter Brandt",
      unit_type: "Champion",
      unit_kind: "hero",
      out_of_action: true,
      kill_count: 0,
      xp_earned: 0,
      dead: false,
      special_ids: [],
      serious_injury_rolls: [robbed],
      advances: [],
    },
  },
  mount_survival: {},
} as unknown as BattlePostbattleState;

const base = postbattleRules();
const rules: BattlePostbattleRules = {
  ...base,
  injury_tables: {
    ...base.injury_tables,
    d66: [
      {
        low: 36,
        high: 36,
        label: "Robbed",
        effect: { kind: "manual" },
        text: "He gets away with nothing he carried.",
      },
    ],
  },
};

describe("InjuriesTab", () => {
  it("gives a rolled result its book line and no line about mounts nobody lost", () => {
    render(
      <InjuriesTab
        draft={draft}
        roster={undefined}
        rules={rules}
        suggestion={undefined}
        isMobile={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Dieter Brandt" })).toBeInTheDocument();
    expect(screen.getByText("He gets away with nothing he carried.")).toBeInTheDocument();
    expect(screen.queryByText(/No mount was lost/)).toBeNull();
  });
});
