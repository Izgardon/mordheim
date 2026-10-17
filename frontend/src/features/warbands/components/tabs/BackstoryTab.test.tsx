import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BackstoryTab from "./BackstoryTab";
import { renderWithQueryClient } from "@/test/query-test-utils";

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
