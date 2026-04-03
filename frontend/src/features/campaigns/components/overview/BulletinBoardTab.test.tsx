import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BulletinBoardTab from "./BulletinBoardTab";

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    user: { id: 7 },
  }),
}));

describe("BulletinBoardTab", () => {
  it("renders the bulletin board, wanted poster, and most dangerous table without the old heading", () => {
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
    expect(screen.getByRole("region", { name: "Bulletin Board" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Wanted poster" })).toBeInTheDocument();
    expect(screen.getAllByText("Captain Wolf")).toHaveLength(2);
    expect(screen.getByText("Most Dangerous")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("reveals the inline composer from the header button and submits trimmed input", async () => {
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

    expect(screen.queryByLabelText("Bulletin note")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add note/i }));

    const input = screen.getByLabelText("Bulletin note");
    fireEvent.change(input, { target: { value: "  Need black powder and a lantern  " } });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Post" }));
    });

    expect(onCreateBulletinEntry).toHaveBeenCalledWith("Need black powder and a lantern");
    await waitFor(() => {
      expect(screen.queryByLabelText("Bulletin note")).not.toBeInTheDocument();
    });
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

    const ownDeleteButton = screen.getByRole("button", { name: "Delete bulletin note 11" });
    expect(screen.queryByRole("button", { name: "Delete bulletin note 12" })).not.toBeInTheDocument();

    await user.click(ownDeleteButton);
    expect(onDeleteBulletinEntry).toHaveBeenCalledWith(11);
  });

  it("renders the most dangerous section as a normal table", () => {
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
          {
            unit_id: 4,
            unit_kind: "hero",
            unit_name: "Blade Jack",
            unit_type: "Champion",
            warband_id: 13,
            warband_name: "Black Rats",
            kills: 5,
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

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Unit" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Warband" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Kills" })).toBeInTheDocument();
    expect(within(table).getByText("Captain Wolf")).toBeInTheDocument();
    expect(within(table).getByText("Black Rats")).toBeInTheDocument();
  });
});
