import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { renderWithQueryClient } from "@/test/query-test-utils";
import JoinCodeBadge from "./JoinCodeBadge";

describe("JoinCodeBadge", () => {
  it("is an icon-only New code button beside the phone's tabs, still named for screen readers", () => {
    renderWithQueryClient(
      <JoinCodeBadge campaign={campaignSummary()} canRegenerate onRegenerated={vi.fn()} compact />
    );

    const button = screen.getByRole("button", { name: "New code" });
    expect(button).toHaveAttribute("title", "New code");
    expect(screen.getByText("New code")).toHaveClass("sr-only");
    expect(screen.getByText("WYR123")).toBeInTheDocument();
  });

  it("shows the code with no button to a member who can't regenerate it", () => {
    renderWithQueryClient(
      <JoinCodeBadge campaign={campaignSummary()} canRegenerate={false} onRegenerated={vi.fn()} />
    );

    expect(screen.getByText("WYR123")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
