import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SegmentedTabs } from "./segmented-tabs";

const TABS = [
  { id: "mine", label: "Mine" },
  { id: "theirs", label: "Theirs" },
  { id: "neutral", label: "Neutral", disabled: true },
  { id: "all", label: "All" },
] as const;

function Harness() {
  const [value, setValue] = useState<(typeof TABS)[number]["id"]>("mine");
  return <SegmentedTabs tabs={TABS} value={value} onValueChange={setValue} aria-label="Whose" />;
}

describe("SegmentedTabs", () => {
  it("selects a tab on click, and only the selected tab is in the tab order", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("tab", { name: "Theirs" }));

    expect(screen.getByRole("tab", { name: "Theirs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Theirs" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves with the arrow keys, Home and End, skipping disabled tabs and wrapping", () => {
    render(<Harness />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    fireEvent.keyDown(tab("Mine"), { key: "ArrowRight" });
    expect(tab("Theirs")).toHaveAttribute("aria-selected", "true");
    expect(tab("Theirs")).toHaveFocus();

    fireEvent.keyDown(tab("Theirs"), { key: "ArrowRight" });
    expect(tab("All")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("All"), { key: "ArrowRight" });
    expect(tab("Mine")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Mine"), { key: "ArrowLeft" });
    expect(tab("All")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("All"), { key: "Home" });
    expect(tab("Mine")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Mine"), { key: "End" });
    expect(tab("All")).toHaveAttribute("aria-selected", "true");
  });
});
