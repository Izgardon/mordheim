import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BackstoryTab from "./BackstoryTab";
import { updateWarband } from "../../api/warbands-api";
import { ApiError } from "@/lib/api-client";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { Warband } from "../../types/warband-types";

vi.mock("../../api/warbands-api", () => ({ updateWarband: vi.fn() }));

const warband = {
  id: 9,
  campaign_id: 7,
  user_id: 1,
  name: "The Black Wolves",
  faction: "Mercenaries",
  backstory: "Born in the ruins.",
  created_at: "",
  updated_at: "",
} as Warband;

describe("BackstoryTab", () => {
  it("offers editing only with the edit_backstory capability (BUG-31)", () => {
    const { unmount } = renderWithQueryClient(
      <BackstoryTab warband={warband} canEdit={false} onWarbandUpdated={vi.fn()} />
    );
    expect(screen.getByText("Born in the ruins.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit backstory" })).not.toBeInTheDocument();
    unmount();

    renderWithQueryClient(<BackstoryTab warband={warband} canEdit onWarbandUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Edit backstory" })).toBeInTheDocument();
  });
});

describe("BackstoryTab for someone who runs the roster but doesn't own it (decision 13)", () => {
  it("reads the story and says only the owner can write it", () => {
    renderWithQueryClient(
      <BackstoryTab warband={warband} canEdit={false} canEditRoster onWarbandUpdated={vi.fn()} />
    );

    expect(screen.getByText("Born in the ruins.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit backstory" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Only the warband's owner can write its backstory.")
    ).toBeInTheDocument();
  });

  it("explains the server's owner-only refusal", async () => {
    const user = setupUser();
    vi.mocked(updateWarband).mockRejectedValue(
      new ApiError("Only the warband's owner can change its backstory.", 403, {
        detail: "Only the warband's owner can change its backstory.",
        code: "backstory_owner_only",
        fields: { backstory: ["Only the warband's owner can change its backstory."] },
      })
    );
    renderWithQueryClient(<BackstoryTab warband={warband} canEdit onWarbandUpdated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit backstory" }));
    await user.click(screen.getByRole("button", { name: "Save backstory" }));

    expect(
      await screen.findByText("Only the warband's owner can change its backstory.")
    ).toBeInTheDocument();
  });
});
