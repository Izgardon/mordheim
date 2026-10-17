import { render, screen } from "@testing-library/react";
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
});
