import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PrebattleDialogs from "./PrebattleDialogs";

const renderDialogs = (open: { leave?: boolean; start?: boolean; cancel?: boolean }) =>
  render(
    <PrebattleDialogs
      isLeaveDialogOpen={Boolean(open.leave)}
      onLeaveDialogChange={vi.fn()}
      onConfirmLeave={vi.fn()}
      isStartDialogOpen={Boolean(open.start)}
      onStartDialogChange={vi.fn()}
      startError=""
      isStartingBattle={false}
      onConfirmStart={vi.fn()}
      isCancelBattleDialogOpen={Boolean(open.cancel)}
      onCancelBattleDialogChange={vi.fn()}
      cancelBattleError=""
      isCancelingBattle={false}
      onConfirmCancelBattle={vi.fn()}
    />
  );

describe("PrebattleDialogs", () => {
  it("describes the Cancel Battle dialog to screen readers (BUG-126)", () => {
    renderDialogs({ cancel: true });

    expect(screen.getByRole("dialog", { name: "Cancel Battle" })).toHaveAccessibleDescription(
      "Cancel this battle for all participants? This is only available before the battle starts."
    );
  });

  it("describes the Leave and Start confirms", () => {
    const { unmount } = renderDialogs({ leave: true });
    expect(screen.getByRole("dialog", { name: "Leave" })).toHaveAccessibleDescription(
      "Leave this battle session? You can return later from the campaign overview while the battle is still open."
    );
    unmount();

    renderDialogs({ start: true });
    expect(screen.getByRole("dialog", { name: "Start" })).toHaveAccessibleDescription(
      "All participants are ready. Start the battle now?"
    );
  });
});
