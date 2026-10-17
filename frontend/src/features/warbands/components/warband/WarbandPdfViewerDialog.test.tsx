import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WarbandPdfViewerDialog from "./WarbandPdfViewerDialog";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const renderDialog = (url: string) =>
  render(<WarbandPdfViewerDialog open onOpenChange={vi.fn()} url={url} />);

describe("WarbandPdfViewerDialog (SEC-14)", () => {
  it("frames a Google Doc in a sandbox, without clipboard reads", () => {
    renderDialog("https://docs.google.com/document/d/D0c/edit");

    const frame = screen.getByTitle("Warband Link");
    expect(frame).toHaveAttribute("src", "https://docs.google.com/document/d/D0c/preview");
    expect(frame.getAttribute("sandbox")).toContain("allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame.getAttribute("allow")).not.toContain("clipboard-read");
    expect(screen.getByRole("link", { name: "Open link in new tab" })).toHaveAttribute(
      "href",
      "https://docs.google.com/document/d/D0c/edit"
    );
  });

  it("shows any other site as a link that opens in a new tab, not in a frame", () => {
    renderDialog("https://example.com/roster.pdf");

    expect(screen.queryByTitle("Warband Link")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open link in new tab" });
    expect(link).toHaveAttribute("href", "https://example.com/roster.pdf");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
