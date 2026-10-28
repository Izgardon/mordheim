/** Settings → Personal → Account: the way to the account page (AUTH-NEW-01), the list and Log out. */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";
import PersonalSettingsCard from "./PersonalSettingsCard";

describe("PersonalSettingsCard", () => {
  it("links to the account page beside Campaigns and Log out", async () => {
    const onSignOut = vi.fn();
    render(
      <MemoryRouter initialEntries={["/campaigns/1/settings"]}>
        <Routes>
          <Route
            path="/campaigns/1/settings"
            element={<PersonalSettingsCard onSignOut={onSignOut} onOpenCampaigns={vi.fn()} />}
          />
          <Route path="/account" element={<p>Account page</p>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Campaigns" })).toBeInTheDocument();
    await setupUser().click(screen.getByRole("button", { name: "Log out" }));
    expect(onSignOut).toHaveBeenCalledOnce();

    await setupUser().click(screen.getByRole("link", { name: "Manage account" }));

    expect(screen.getByText("Account page")).toBeInTheDocument();
  });
});
