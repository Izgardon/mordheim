import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WarbandSectionShell from "./WarbandSectionShell";

describe("WarbandSectionShell", () => {
  it("shows a floating desktop action panel while editing", () => {
    render(
      <WarbandSectionShell
        title="Heroes"
        isEditing
        canEdit
        onCancel={vi.fn()}
        onSave={vi.fn()}
      >
        <div>Hero form</div>
      </WarbandSectionShell>
    );

    expect(screen.getByTestId("warband-section-floating-actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Heroes" })).not.toBeInTheDocument();
  });

  it("shows the header edit button when not editing", () => {
    render(
      <WarbandSectionShell title="Henchmen" canEdit onEdit={vi.fn()}>
        <div>Summary</div>
      </WarbandSectionShell>
    );

    expect(screen.getAllByRole("button", { name: "Edit Henchmen" })).toHaveLength(2);
    expect(
      screen.queryByTestId("warband-section-floating-actions")
    ).not.toBeInTheDocument();
  });

  it("does not render floating actions when section actions are hidden", () => {
    render(
      <WarbandSectionShell
        title="Hired Swords"
        isEditing
        canEdit
        actionsHidden
        onCancel={vi.fn()}
        onSave={vi.fn()}
      >
        <div>Hired sword form</div>
      </WarbandSectionShell>
    );

    expect(
      screen.queryByTestId("warband-section-floating-actions")
    ).not.toBeInTheDocument();
  });
});
