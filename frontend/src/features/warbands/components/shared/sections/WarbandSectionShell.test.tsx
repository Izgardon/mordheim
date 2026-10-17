import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WarbandSectionShell from "./WarbandSectionShell";

describe("WarbandSectionShell", () => {
  it("shows a floating desktop action panel while editing", () => {
    render(
      <WarbandSectionShell title="Heroes" isEditing canEdit onCancel={vi.fn()} onSave={vi.fn()}>
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
    expect(screen.queryByTestId("warband-section-floating-actions")).not.toBeInTheDocument();
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

    expect(screen.queryByTestId("warband-section-floating-actions")).not.toBeInTheDocument();
  });

  it("shows gold after pending below zero in red, not clamped at zero (decision 1)", () => {
    render(
      <WarbandSectionShell
        title="Heroes"
        isEditing
        canEdit
        availableGold={40}
        pendingChanges={[
          {
            label: "Gunther (recruit)",
            category: "recruit",
            quantity: 1,
            unitCost: 60,
            amount: 60,
          },
        ]}
      >
        <div>Hero form</div>
      </WarbandSectionShell>
    );

    expect(screen.getByText(/Pending spend: 60 gc/)).toBeInTheDocument();
    expect(screen.getByText("-20 gc")).toHaveClass("text-red-400");
  });
});
