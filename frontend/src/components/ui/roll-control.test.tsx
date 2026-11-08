import { useState, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import RollControl from "./roll-control";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

type Props = Partial<ComponentProps<typeof RollControl>>;

/** The caller keeping the faces it is given (unless `keep` is off: a save that failed). */
function Kept({ keep = true, onResult, ...props }: Props & { keep?: boolean }) {
  const [faces, setFaces] = useState<number[] | null>(null);
  return (
    <RollControl
      dice="2D6"
      label="Roll to search"
      lockedLabel="Searched"
      faces={faces}
      onResult={(next) => {
        onResult?.(next);
        if (keep) setFaces(next);
      }}
      {...props}
    />
  );
}

const button = (name: string) => screen.getByRole("button", { name });

describe("RollControl, the store's search", () => {
  beforeEach(() => vi.mocked(rollDie).mockReset());

  it("rolls the dice here, shows them with the bonus and the verdict, and locks", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(4).mockReturnValueOnce(2);
    const onResult = vi.fn();
    const user = setupUser();
    render(<Kept bonus={1} verdict="Found" onResult={onResult} />);

    await user.click(button("Roll to search"));

    expect(onResult).toHaveBeenCalledWith([4, 2]);
    expect(screen.getByRole("status")).toHaveTextContent("4 2 +1 = 7 Found");
    expect(button("Searched")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Roll to search" })).toBeNull();
    expect(screen.queryByRole("button", { name: "or enter your dice" })).toBeNull();
  });

  it("takes the dice typed in behind the link, as a roll", async () => {
    const onResult = vi.fn();
    const user = setupUser();
    render(<Kept bonus={-1} onResult={onResult} />);
    expect(screen.queryByLabelText("First D6 rolled")).toBeNull();

    await user.click(button("or enter your dice"));
    expect(screen.getByLabelText("First D6 rolled")).toHaveFocus();
    await user.keyboard("3");
    // one die in: the button waits for the other
    expect(button("Roll to search")).toBeDisabled();
    await user.keyboard("5");

    expect(onResult).toHaveBeenCalledWith([3, 5]);
    expect(rollDie).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("3 5 -1 = 7");
    expect(button("Searched")).toBeDisabled();
    expect(screen.queryByLabelText("First D6 rolled")).toBeNull();
  });

  it("says no bonus when there is none", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(6).mockReturnValueOnce(1);
    const user = setupUser();
    render(<Kept />);
    await user.click(button("Roll to search"));
    expect(screen.getByRole("status").textContent?.replace(/\s+/g, " ").trim()).toBe("6 1 = 7");
  });

  it("stays open while the caller doesn't keep the roll", async () => {
    vi.mocked(rollDie).mockReturnValue(3);
    const onResult = vi.fn();
    const user = setupUser();
    render(<Kept keep={false} onResult={onResult} />);
    await user.click(button("Roll to search"));
    await user.click(button("Roll to search"));
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("can't be rolled or typed into while disabled", () => {
    render(<Kept disabled />);
    expect(button("Roll to search")).toBeDisabled();
    expect(button("or enter your dice")).toBeDisabled();
  });
});

describe("RollControl, a location's roll", () => {
  beforeEach(() => vi.mocked(rollDie).mockReset());
  const location = { dice: "D6", label: "Roll D6", lockedLabel: "Rolled", entry: "above" } as const;

  it("has its box above the button, which shows the die rolled and locks as Rolled", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(5);
    const user = setupUser();
    render(<Kept {...location} />);
    const box = screen.getByLabelText("D6 rolled");
    expect(box.compareDocumentPosition(button("Roll D6"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByRole("button", { name: "or enter your dice" })).toBeNull();

    await user.click(button("Roll D6"));

    expect(screen.getByLabelText("D6 rolled")).toHaveValue("5");
    expect(button("Rolled")).toBeDisabled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("takes the die typed in its box", async () => {
    const onResult = vi.fn();
    const user = setupUser();
    render(<Kept {...location} onResult={onResult} />);
    await user.type(screen.getByLabelText("D6 rolled"), "4");
    expect(onResult).toHaveBeenCalledWith([4]);
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("4");
    expect(button("Rolled")).toBeDisabled();
    expect(rollDie).not.toHaveBeenCalled();
  });
});
