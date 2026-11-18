/**
 * The settings cards' shape (William, 18 Nov 2026, from his phone, where the Leave campaign and
 * Delete warband cards broke: "In these kind of cards the subtitle text can live underneath the
 * button too so be full width"). The heading and the button share the top row; the description
 * sits below them, across the card, so a wide button can't squeeze it into a column a word wide.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

import { SettingsCard } from "./settings-ui";

const LOSSY = "You're the only member, so leaving archives the campaign.";

describe("SettingsCard", () => {
  it("puts the description under the heading's row, not beside the button", () => {
    render(
      <SettingsCard
        title="Leave campaign"
        tone="danger"
        description={LOSSY}
        action={<Button variant="danger">Leave</Button>}
      />
    );

    const row = screen.getByRole("heading", { name: "Leave campaign" }).parentElement;
    const description = screen.getByText(LOSSY);

    expect(row).toContainElement(screen.getByRole("button", { name: "Leave" }));
    expect(row).not.toContainElement(description);
    // and it comes after that row, so it reads under it
    expect(row!.compareDocumentPosition(description)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("still holds a card with no description or button", () => {
    render(
      <SettingsCard title="Warband rules">
        <p>Three rules.</p>
      </SettingsCard>
    );

    const card = screen.getByRole("region", { name: "Warband rules" });

    expect(screen.getByRole("heading", { name: "Warband rules" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Three rules.");
  });
});
