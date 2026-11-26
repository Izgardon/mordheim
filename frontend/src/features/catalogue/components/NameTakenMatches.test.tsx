import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

const show = (matches: NameMatch[]) =>
  render(
    <NameTakenMatches
      id="taken"
      nameTaken={{ matches, onEdit: vi.fn(), onRestore: vi.fn(async () => undefined) }}
    />
  );

describe("NameTakenMatches", () => {
  it("offers Edit this instead and Restore where the server's match allows them", () => {
    show([match({}), match({ id: 2, source: "campaign", archived: true, restorable: true })]);

    expect(screen.getByRole("button", { name: "Edit the book Axe instead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore this campaign's Axe" })).toBeInTheDocument();
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
