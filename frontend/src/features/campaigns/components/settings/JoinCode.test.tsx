/**
 * The join code: Copy is the icon beside the code, and New code sits against the far edge
 * (William, 18 Nov 2026).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";

import JoinCode from "./JoinCode";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("../../hooks/useCampaignQuery", () => ({ useSetCampaign: () => vi.fn() }));

const campaign = campaignSummary({ join_code: "DWOMOE" });

describe("JoinCode", () => {
  it("copies from an icon, not a button labelled Copy", () => {
    render(<JoinCode campaign={campaign} canRegenerate />);

    expect(screen.getByRole("button", { name: "Copy the join code" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  });

  it("puts the code, then Copy, then New code", () => {
    render(<JoinCode campaign={campaign} canRegenerate />);

    const row = screen.getByText("DWOMOE").parentElement as HTMLElement;
    const names = [...row.querySelectorAll("button")].map((button) =>
      (button.getAttribute("aria-label") ?? button.textContent ?? "").trim()
    );
    expect(names).toEqual(["Copy the join code", "New code"]);
  });

  it("leaves New code out for a member who may not regenerate it", () => {
    render(<JoinCode campaign={campaign} canRegenerate={false} />);

    expect(screen.getByRole("button", { name: "Copy the join code" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New code" })).not.toBeInTheDocument();
  });
});
