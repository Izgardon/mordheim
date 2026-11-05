import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConfirmResults } from "@/features/battles/hooks/useConfirmResults";
import { ME, battleState } from "@/test/battle-fixtures";

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
  it("says the results change until every aftermath is done, not until a fight that has ended", () => {
    const state = battleState({
      status: "postbattle",
      results_pending: false,
      winner_warband_ids_json: [ME.warband.id],
    });
    render(<ResultsBanner state={state} results={results} />);
    expect(
      screen.getByText(
        `Results confirmed: ${ME.warband.name} won. You can change them until every aftermath is done.`
      )
    ).toBeInTheDocument();
  });
});
