/**
 * The aftermath's results banner (William, 18 Nov 2026: "lets make it changeable in the battle
 * section of settings for owner and admin, nowhere else"): it asks the last player to finish to
 * confirm who won, and goes once they are confirmed — changing them is Settings → Battles'.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConfirmResults } from "@/features/battles/hooks/useConfirmResults";
import { ME, OPPONENT, battleState } from "@/test/battle-fixtures";

import ResultsBanner from "./ResultsBanner";

const results: ConfirmResults = {
  canConfirm: true,
  pending: false,
  isOpen: false,
  openChange: vi.fn(),
  isSubmitting: false,
  error: "",
  submit: vi.fn(),
};

describe("ResultsBanner", () => {
  it("asks the player who may confirm the results who won", () => {
    const state = battleState({ status: "postbattle", results_pending: true });

    render(<ResultsBanner state={state} results={results} />);

    expect(screen.getByText(/Confirm who won/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm results" })).toBeInTheDocument();
  });

  it("names whoever is holding the results up for everyone else", () => {
    const state = battleState({
      status: "postbattle",
      results_pending: true,
      results_confirmer_user_id: OPPONENT.id,
    });

    render(<ResultsBanner state={state} results={{ ...results, canConfirm: false }} />);

    expect(screen.getByText(`Waiting for ${OPPONENT.label} to confirm the results.`)).toBeVisible();
  });

  it("shows nothing once the results are confirmed: they change in Settings now", () => {
    const state = battleState({
      status: "postbattle",
      results_pending: false,
      winner_warband_ids_json: [ME.warband.id],
    });

    render(<ResultsBanner state={state} results={results} />);

    expect(screen.queryByLabelText("Results")).toBeNull();
    expect(screen.queryByRole("button", { name: /results/i })).toBeNull();
  });
});
