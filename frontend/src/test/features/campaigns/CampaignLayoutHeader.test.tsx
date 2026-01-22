import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CampaignLayoutHeader from "../../../features/campaigns/components/CampaignLayoutHeader";

describe("CampaignLayoutHeader", () => {
  it("calls onOpenNav when the menu button is clicked", async () => {
    const onOpenNav = vi.fn();
    const user = userEvent.setup();

    render(<CampaignLayoutHeader onOpenNav={onOpenNav} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /menu/i }));
    });
    expect(onOpenNav).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without onOpenNav", () => {
    const { container } = render(<CampaignLayoutHeader />);

    expect(container).toBeEmptyDOMElement();
  });
});




