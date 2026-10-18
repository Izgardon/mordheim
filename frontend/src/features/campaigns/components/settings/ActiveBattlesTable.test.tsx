import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { battleState } from "@/test/battle-fixtures";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import type { CampaignActiveBattle } from "../../types/campaign-types";
import ActiveBattlesTable from "./ActiveBattlesTable";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const inPhase = (status: "active" | "postbattle"): CampaignActiveBattle => {
  const { battle, participants } = battleState({
    status,
    me: status === "postbattle" ? { status: "confirmed_postbattle" } : {},
  });
  return { battle, participants };
};

const renderTable = (battle: CampaignActiveBattle) => {
  const onCancelBattle = vi.fn(async () => undefined);
  const onCloseBattle = vi.fn(async () => undefined);
  renderWithQueryClient(
    <ActiveBattlesTable
      isLoading={false}
      error=""
      battles={[battle]}
      onCancelBattle={onCancelBattle}
      onCloseBattle={onCloseBattle}
    />
  );
  return { onCancelBattle, onCloseBattle };
};

describe("ActiveBattlesTable (BUG-09)", () => {
  it("closes a battle in postbattle instead of cancelling it, naming who is skipped", async () => {
    const user = setupUser();
    const { onCancelBattle, onCloseBattle } = renderTable(inPhase("postbattle"));

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    const dialog = screen.getByRole("dialog", { name: "Close postbattle" });
    // You finalised; the other player hasn't.
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["Player (Night Razors)"]);
    await user.click(within(dialog).getByRole("button", { name: "Close postbattle" }));

    await waitFor(() => expect(onCloseBattle).toHaveBeenCalledWith(5));
    expect(onCancelBattle).not.toHaveBeenCalled();
  });

  it("offers Close postbattle when a cancel answers that the battle reached postbattle", async () => {
    const user = setupUser();
    const { onCancelBattle, onCloseBattle } = renderTable(inPhase("active"));
    onCancelBattle.mockRejectedValueOnce(
      new ApiError("Bad request", 400, {
        detail: "Postbattle can't be cancelled; close it instead",
        code: "use_close_postbattle",
      })
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Confirm cancel" }));

    const dialog = await screen.findByRole("dialog", { name: "Close postbattle" });
    expect(dialog).toHaveTextContent(
      "This battle has reached postbattle, so it can only be closed."
    );
    await user.click(within(dialog).getByRole("button", { name: "Close postbattle" }));
    await waitFor(() => expect(onCloseBattle).toHaveBeenCalledWith(5));
  });
});
