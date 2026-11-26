import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OwnWordsContext, WORKSHOP_WORDS } from "@/features/reference/own-words";
import type { NameMatch } from "@/lib/field-errors";

import { NameTakenMatches } from "./NameTakenMatches";

const match = (overrides: Partial<NameMatch>): NameMatch => ({
  kind: "items",
  id: 1,
  name: "Axe",
  type: null,
  source: "book",
  archived: false,
  editable: true,
  restorable: false,
  ...overrides,
});

const taken = (matches: NameMatch[]) => (
  <NameTakenMatches
    id="taken"
    nameTaken={{ matches, onEdit: vi.fn(), onRestore: vi.fn(async () => undefined) }}
  />
);
const show = (matches: NameMatch[]) => render(taken(matches));

describe("NameTakenMatches", () => {
  it("offers Edit this instead and Restore where the server's match allows them", () => {
    show([match({}), match({ id: 2, source: "campaign", archived: true, restorable: true })]);

    expect(screen.getByRole("button", { name: "Edit the book Axe instead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore this campaign's Axe" })).toBeInTheDocument();
    expect(screen.getByText(/Axe · this campaign/)).toBeInTheDocument();
  });

  it("names a workshop's own entry the player's (William, 26 Nov 2026)", () => {
    render(
      <OwnWordsContext.Provider value={WORKSHOP_WORDS}>
        {taken([match({ source: "campaign" })])}
      </OwnWordsContext.Provider>
    );

    expect(screen.getByRole("button", { name: "Edit your Axe instead" })).toBeInTheDocument();
    expect(screen.getByText("Axe · yours")).toBeInTheDocument();
  });

  it("in a workshop offers nothing on a book entry nor on a deleted one still in use", () => {
    show([
      match({ editable: false }),
      match({ id: 2, source: "campaign", archived: true, editable: false }),
    ]);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/deleted, still in use/)).toBeInTheDocument();
  });
});
