import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import BattleNotesDialog from "../BattleNotesDialog";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

describe("BattleNotesDialog", () => {
  it("closes without saving when notes are unchanged", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <BattleNotesDialog open notes="Hold the center" onOpenChange={onOpenChange} onSave={onSave} />
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("saves updated notes when closed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<BattleNotesDialog open notes="" onOpenChange={onOpenChange} onSave={onSave} />);

    await user.type(screen.getByLabelText("Battle Notes"), "Protect the wyrdstone.");
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Protect the wyrdstone.");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and shows an error when save fails", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error("Unable to save battle notes"));

    render(<BattleNotesDialog open notes="" onOpenChange={onOpenChange} onSave={onSave} />);

    await user.type(screen.getByLabelText("Battle Notes"), "Push left flank");
    await user.click(screen.getByRole("button", { name: "Close" }));

    await screen.findByText("Unable to save battle notes");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
