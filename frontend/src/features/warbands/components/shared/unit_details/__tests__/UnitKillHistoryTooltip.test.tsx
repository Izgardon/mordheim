import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({
    trigger,
    content,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    content: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleToggle = () => {
      const nextOpen = !isOpen;
      setIsOpen(nextOpen);
      onOpenChange?.(nextOpen);
    };

    return (
      <div>
        <div onClick={handleToggle}>{trigger}</div>
        {isOpen ? <div role="tooltip">{content}</div> : null}
      </div>
    );
  },
}));

import UnitKillHistoryTooltip from "../UnitKillHistoryTooltip";

describe("UnitKillHistoryTooltip", () => {
  it("loads named kills on click, renders the sentence copy, and caches the result", async () => {
    const user = userEvent.setup();
    const loadKillHistory = vi.fn().mockResolvedValue({
      total_kills: 8,
      named_kills_count: 2,
      named_kills: [
        {
          victim_name: "Klaus",
          victim_warband_name: "Reiklanders",
          scenario_name: "Chance Encounter",
        },
        {
          victim_name: "Mira",
          victim_warband_name: "Sisters of Sigmar",
          scenario_name: "",
        },
      ],
    });

    render(
      <UnitKillHistoryTooltip
        totalKills={8}
        loadKillHistory={loadKillHistory}
        ariaLabel="Show named kills"
      >
        <div>Kills 8</div>
      </UnitKillHistoryTooltip>
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Show named kills" }));
    });

    await waitFor(() => expect(loadKillHistory).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Named kills (2/8)")).toBeInTheDocument();
    expect(
      screen.getByText("Killed Klaus of Reiklanders during Chance Encounter")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Killed Mira of Sisters of Sigmar during an unknown scenario")
    ).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Show named kills" }));
    });
    await waitFor(() =>
      expect(screen.queryByText("Named kills (2/8)")).not.toBeInTheDocument()
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Show named kills" }));
    });
    expect(
      await screen.findByText("Killed Klaus of Reiklanders during Chance Encounter")
    ).toBeInTheDocument();
    expect(loadKillHistory).toHaveBeenCalledTimes(1);
  });

  it("shows loading and empty states", async () => {
    const user = userEvent.setup();
    let resolveKillHistory: ((value: { total_kills: number; named_kills_count: number; named_kills: [] }) => void) | null =
      null;
    const loadKillHistory = vi.fn(
      () =>
        new Promise<{ total_kills: number; named_kills_count: number; named_kills: [] }>((resolve) => {
          resolveKillHistory = resolve;
        })
    );

    render(
      <UnitKillHistoryTooltip
        totalKills={0}
        loadKillHistory={loadKillHistory}
        ariaLabel="Show empty named kills"
      >
        <div>Kills 0</div>
      </UnitKillHistoryTooltip>
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Show empty named kills" }));
    });
    expect(await screen.findByText("Loading named kills...")).toBeInTheDocument();

    await act(async () => {
      resolveKillHistory?.({
        total_kills: 0,
        named_kills_count: 0,
        named_kills: [],
      });
    });

    expect(await screen.findByText("Named kills (0/0)")).toBeInTheDocument();
    expect(screen.getByText("No named kills recorded.")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    const user = userEvent.setup();
    const loadKillHistory = vi.fn().mockRejectedValue(new Error("boom"));

    render(
      <UnitKillHistoryTooltip
        totalKills={3}
        loadKillHistory={loadKillHistory}
        ariaLabel="Show broken named kills"
      >
        <div>Kills 3</div>
      </UnitKillHistoryTooltip>
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Show broken named kills" }));
    });

    expect(await screen.findByText("Unable to load named kills")).toBeInTheDocument();
  });
});
