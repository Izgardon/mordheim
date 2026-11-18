import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedLine } from "@/features/battles/utils/battle-feed";

import BattleFeed from "./BattleFeed";

const line = (id: number, text: string): FeedLine => ({
  id,
  round: 1,
  text,
  kill: false,
  voided: false,
  undoable: false,
});

describe("BattleFeed", () => {
  it("keeps its own overscroll, so scrolling it can't pull the page to refresh", () => {
    render(<BattleFeed lines={[line(1, "Battle started")]} onUndo={vi.fn()} />);
    const list = screen.getByRole("list");
    expect(list.className).toMatch(/overflow-y-auto/);
    expect(list.className).toMatch(/overscroll-contain/);
  });

  it("shows each line under its round", () => {
    render(<BattleFeed lines={[line(1, "Round 2 started")]} onUndo={vi.fn()} />);
    expect(screen.getByText("Round 2 started")).toBeInTheDocument();
    expect(screen.getByText("R1")).toBeInTheDocument();
  });
});
