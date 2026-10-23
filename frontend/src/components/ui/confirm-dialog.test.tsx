import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("names the dialog for screen readers and describes it with the message", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        description="Discard your unsaved changes to Heroes?"
        confirmText="Discard changes"
        onConfirm={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Discard changes" });
    expect(dialog).toHaveAccessibleDescription("Discard your unsaved changes to Heroes?");
  });

  it("uses an explicit title as the accessible name", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Dismiss hero"
        description="All items this unit carries are lost."
        confirmText="Dismiss"
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Dismiss hero" })).toBeInTheDocument();
  });

  it("shows extra content under the message, and an error as an alert inside the dialog", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        description="Delete Rusty Cleaver?"
        confirmText="Delete item"
        error="Rusty Cleaver is in use, so nothing was deleted."
        onConfirm={vi.fn()}
      >
        <p>Used by 2 units.</p>
      </ConfirmDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Delete item" });
    expect(within(dialog).getByText("Used by 2 units.")).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Rusty Cleaver is in use, so nothing was deleted."
    );
    expect(dialog).toHaveAccessibleDescription("Delete Rusty Cleaver?");
  });

  it("shows no alert without an error", () => {
    render(
      <ConfirmDialog open onOpenChange={vi.fn()} description="Delete it?" onConfirm={vi.fn()} />
    );

    expect(within(screen.getByRole("dialog")).queryByRole("alert")).toBeNull();
  });
});
