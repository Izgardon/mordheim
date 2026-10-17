import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DICE_LINGER_MS, DiceProvider } from "./DiceProvider";
import DiceRoller from "./DiceRoller";

const { diceBox } = vi.hoisted(() => {
  const instances: { clear: () => void }[] = [];
  const constructed = vi.fn();
  class FakeDiceBox {
    canvas = undefined;
    init = vi.fn(async () => {
      this.resizeWorld();
      return this;
    });
    roll = vi.fn(async () => [{ value: 2 }, { value: 6 }]);
    clear = vi.fn();
    constructor(config: unknown) {
      constructed(config);
      instances.push(this);
    }
    resizeWorld() {
      window.addEventListener("resize", diceBox.onResize);
    }
  }
  return { diceBox: { FakeDiceBox, constructed, instances, onResize: vi.fn() } };
});

vi.mock("@3d-dice/dice-box", () => ({ default: diceBox.FakeDiceBox }));

function RollerDialogs() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen((value) => !value)}>Toggle dialog</button>
      {open ? <DiceRoller fixedNotation="2d6" resultMode="both" /> : null}
    </>
  );
}

describe("DiceRoller with the shared DiceProvider", () => {
  beforeEach(() => {
    diceBox.constructed.mockClear();
    diceBox.instances.length = 0;
    diceBox.onResize.mockClear();
  });

  afterEach(() => {
    window.removeEventListener("resize", diceBox.onResize);
  });

  it("creates one engine however many times rollers mount and unmount", async () => {
    render(
      <DiceProvider>
        <RollerDialogs />
      </DiceProvider>
    );

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Toggle dialog" }));
      fireEvent.click(screen.getByRole("button", { name: "Toggle dialog" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Roll 2d6" }));

    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(diceBox.constructed).toHaveBeenCalledTimes(1);
  });

  it("reports the die values and total, then clears the table after the dice settle", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onRollComplete = vi.fn();
    const onTotalChange = vi.fn();
    render(
      <DiceProvider>
        <DiceRoller
          fixedNotation="2d6"
          onRollComplete={onRollComplete}
          onTotalChange={onTotalChange}
        />
      </DiceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Roll 2d6" }));

    await waitFor(() => expect(onTotalChange).toHaveBeenCalledWith(8));
    expect(onRollComplete).toHaveBeenCalledWith([2, 6]);
    expect(screen.getByTestId("dice-overlay")).toHaveClass("opacity-100");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DICE_LINGER_MS + 10);
    });
    expect(diceBox.instances[0].clear).toHaveBeenCalled();
    expect(screen.getByTestId("dice-overlay")).toHaveClass("opacity-0");
    vi.useRealTimers();
  });

  it("removes the engine's resize listener when the app unmounts", async () => {
    const { unmount } = render(
      <DiceProvider>
        <DiceRoller fixedNotation="2d6" />
      </DiceProvider>
    );
    await waitFor(() => expect(diceBox.constructed).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    window.dispatchEvent(new Event("resize"));
    expect(diceBox.onResize).toHaveBeenCalledTimes(1);
    diceBox.onResize.mockClear();

    unmount();

    window.dispatchEvent(new Event("resize"));
    expect(diceBox.onResize).not.toHaveBeenCalled();
  });
});
