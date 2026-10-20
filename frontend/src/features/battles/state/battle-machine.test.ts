import { describe, expect, it } from "vitest";

import type { BattleStatus, BattleSummary } from "@/features/battles/types/battle-types";
import { battleState } from "@/test/battle-fixtures";

import {
  battleViewPath,
  deriveBattleView,
  pageForStatus,
  phaseFromPath,
  type BattlePhase,
} from "./battle-machine";

const battle = (status: BattleStatus): BattleSummary => battleState({ status }).battle;

const view = (page: BattlePhase, status: BattleStatus) =>
  deriveBattleView({ page, isLoading: false, error: "", battle: battle(status) });

describe("deriveBattleView", () => {
  it("shows the page's own loading line until the state arrives", () => {
    expect(
      deriveBattleView({ page: "active", isLoading: true, error: "", battle: undefined })
    ).toEqual({ kind: "loading", message: "Loading battle..." });
    expect(
      deriveBattleView({ page: "postbattle", isLoading: true, error: "", battle: undefined })
    ).toEqual({ kind: "loading", message: "Loading postbattle..." });
  });

  it("shows the read's error, or the page's own when there is no state", () => {
    expect(
      deriveBattleView({ page: "prebattle", isLoading: false, error: "Nope", battle: undefined })
    ).toEqual({ kind: "error", message: "Nope" });
    expect(
      deriveBattleView({ page: "prebattle", isLoading: false, error: "", battle: null })
    ).toEqual({ kind: "error", message: "Unable to load prebattle." });
  });

  it("sends each phase to its page and an ended or canceled battle to the overview", () => {
    const pages: BattlePhase[] = ["prebattle", "active", "postbattle"];
    for (const page of pages) {
      for (const status of ["prebattle", "active", "postbattle"] as const) {
        expect(view(page, status)).toEqual(
          status === page ? { kind: "ready" } : { kind: "redirect", to: status }
        );
      }
      expect(view(page, "ended")).toEqual({ kind: "redirect", to: "overview" });
      expect(view(page, "canceled")).toEqual({ kind: "redirect", to: "overview" });
    }
  });

  it("leaves an invitation on the page it was opened on", () => {
    expect(view("prebattle", "inviting")).toEqual({ kind: "ready" });
    expect(view("active", "inviting")).toEqual({ kind: "ready" });
    expect(pageForStatus("inviting")).toBeNull();
    expect(pageForStatus("reported_result_pending")).toBeNull();
  });

  it("sends a player who has finished his fight to his postbattle while the battle is active (decision 4)", () => {
    expect(pageForStatus("active", "in_battle")).toBe("active");
    expect(pageForStatus("active", "finished_battle")).toBe("postbattle");
    expect(pageForStatus("active", "confirmed_postbattle")).toBe("postbattle");
    expect(
      deriveBattleView({
        page: "active",
        isLoading: false,
        error: "",
        battle: battle("active"),
        participantStatus: "finished_battle",
      })
    ).toEqual({ kind: "redirect", to: "postbattle" });
  });
});

describe("phaseFromPath", () => {
  it("reads the battle page from the URL's last segment", () => {
    expect(phaseFromPath("/campaigns/1/battles/5/prebattle")).toBe("prebattle");
    expect(phaseFromPath("/campaigns/1/battles/5/active/")).toBe("active");
    expect(phaseFromPath("/campaigns/1/battles/5/postbattle")).toBe("postbattle");
    expect(phaseFromPath("/campaigns/1/battles/5")).toBeNull();
  });
});

describe("battleViewPath", () => {
  it("builds the overview and phase paths", () => {
    expect(battleViewPath("overview", 1, 5)).toBe("/campaigns/1");
    expect(battleViewPath("active", 1, 5)).toBe("/campaigns/1/battles/5/active");
  });
});
