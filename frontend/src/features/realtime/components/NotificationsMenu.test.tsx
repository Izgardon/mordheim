import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import { ApiError } from "@/lib/api-client";
import NotificationsMenu from "./NotificationsMenu";

const trade: TradeNotification = {
  id: "trade-9",
  notificationDbId: 3,
  campaignId: 7,
  fromUser: { id: 2, label: "Mira" },
  fromWarband: { id: 20, name: "Reiklanders" },
  toWarband: { id: 10, name: "Possessed" },
  createdAt: "2026-10-17T10:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
};

function renderMenu(onAcceptTrade: (notification: TradeNotification) => Promise<void>) {
  render(
    <NotificationsMenu
      tradeRequestNotifications={[trade]}
      battleInviteNotifications={[]}
      battleResultRequestNotifications={[]}
      onAcceptTrade={onAcceptTrade}
      onDeclineTrade={vi.fn()}
      onAcceptBattleInvite={vi.fn()}
      onDismissBattleInvite={vi.fn()}
      onAcceptBattleResultRequest={vi.fn()}
      onDeclineBattleResultRequest={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
}

describe("NotificationsMenu", () => {
  it("stays open and shows why when an action fails", async () => {
    const onAcceptTrade = vi.fn(async () => {
      throw new ApiError("Bad request", 400, { detail: "This trade request has expired." });
    });
    renderMenu(onAcceptTrade);

    fireEvent.click(screen.getByRole("button", { name: "Accept trade" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This trade request has expired.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Trade request from Mira")).toBeInTheDocument();
  });

  it("disables the row while the action runs and closes once it succeeds", async () => {
    let finish!: () => void;
    const onAcceptTrade = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    renderMenu(onAcceptTrade);

    fireEvent.click(screen.getByRole("button", { name: "Accept trade" }));
    expect(screen.getByRole("button", { name: "Accept trade" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline trade" })).toBeDisabled();

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onAcceptTrade).toHaveBeenCalledWith(trade);
  });
});
