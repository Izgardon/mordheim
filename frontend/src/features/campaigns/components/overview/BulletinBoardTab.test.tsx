import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BulletinBoardTab from "./BulletinBoardTab";

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    user: { id: 7 },
  }),
}));

describe("BulletinBoardTab", () => {
  it("renders the wanted poster and most dangerous list without the old heading", () => {
    render(
      <BulletinBoardTab
        isTopKillersLoading={false}
        topKillersError=""
        topKillers={[
          {
            unit_id: 3,
            unit_kind: "hero",
            unit_name: "Captain Wolf",
            unit_type: "Captain",
            warband_id: 12,
            warband_name: "Iron Vultures",
            kills: 9,
          },
        ]}
        isBulletinLoading={false}
        bulletinError=""
        bulletinActionError=""
        bulletinEntries={[]}
        isCreatingBulletinEntry={false}
        deletingBulletinEntryIds={[]}
        onCreateBulletinEntry={vi.fn().mockResolvedValue(undefined)}
        onDeleteBulletinEntry={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText("Ones to watch for")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Wanted poster" })).toBeInTheDocument();
    expect(screen.getByText("Captain Wolf")).toBeInTheDocument();
    expect(screen.getByText("Most Dangerous")).toBeInTheDocument();
    expect(screen.getByText("Iron Vultures")).toBeInTheDocument();
  });

  it("submits a trimmed bulletin note and clears the draft on success", async () => {
    const user = userEvent.setup();
    const onCreateBulletinEntry = vi.fn().mockResolvedValue(undefined);

    render(
      <BulletinBoardTab
        isTopKillersLoading={false}
        topKillersError=""
        topKillers={[]}
        isBulletinLoading={false}
        bulletinError=""
        bulletinActionError=""
        bulletinEntries={[]}
        isCreatingBulletinEntry={false}
        deletingBulletinEntryIds={[]}
        onCreateBulletinEntry={onCreateBulletinEntry}
        onDeleteBulletinEntry={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const input = screen.getByLabelText("Pin a note");
    await user.type(input, "  Need black powder and a lantern  ");
    await user.click(screen.getByRole("button", { name: "Pin Note" }));

    expect(onCreateBulletinEntry).toHaveBeenCalledWith("Need black powder and a lantern");
    expect(screen.getByLabelText("Pin a note")).toHaveValue("");
  });

  it("only shows delete controls for the current user's notes", async () => {
    const user = userEvent.setup();
    const onDeleteBulletinEntry = vi.fn().mockResolvedValue(undefined);

    render(
      <BulletinBoardTab
        isTopKillersLoading={false}
        topKillersError=""
        topKillers={[]}
        isBulletinLoading={false}
        bulletinError=""
        bulletinActionError=""
        bulletinEntries={[
          {
            id: 11,
            campaign_id: 2,
            user_id: 7,
            username: "Owner",
            body: "Selling rope and hooks.",
            created_at: "2026-04-03T10:00:00Z",
          },
          {
            id: 12,
            campaign_id: 2,
            user_id: 8,
            username: "Player",
            body: "Need a blunderbuss.",
            created_at: "2026-04-02T10:00:00Z",
          },
        ]}
        isCreatingBulletinEntry={false}
        deletingBulletinEntryIds={[]}
        onCreateBulletinEntry={vi.fn().mockResolvedValue(undefined)}
        onDeleteBulletinEntry={onDeleteBulletinEntry}
      />
    );

    const ownDeleteButton = screen.getByRole("button", { name: "Delete bulletin note by Owner" });
    expect(screen.queryByRole("button", { name: "Delete bulletin note by Player" })).not.toBeInTheDocument();

    await user.click(ownDeleteButton);
    expect(onDeleteBulletinEntry).toHaveBeenCalledWith(11);
  });
});
