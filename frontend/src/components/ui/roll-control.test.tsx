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
      dice="D6"
      label="Roll D6"
      lockedLabel="Rolled"
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

describe("RollControl, a location's roll", () => {
  beforeEach(() => vi.mocked(rollDie).mockReset());
  const location = { dice: "D6", label: "Roll D6", lockedLabel: "Rolled" } as const;

  it("has its box above the button, which shows the die rolled and locks as Rolled", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(5);
    const user = setupUser();
    render(<Kept {...location} />);
    const box = screen.getByLabelText("D6 rolled");
    expect(box.compareDocumentPosition(button("Roll D6"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(button("Roll D6"));

    expect(screen.getByLabelText("D6 rolled")).toHaveValue("5");
    expect(button("Rolled")).toBeDisabled();
  });

  it("waits for every die before the button rolls", async () => {
    const user = setupUser();
    render(<Kept dice="2D6" label="Roll 2D6" />);
    await user.type(screen.getByLabelText("First D6 rolled"), "3");
    expect(button("Roll 2D6")).toBeDisabled();
  });

  it("can't be rolled or typed into while disabled", () => {
    render(<Kept {...location} disabled />);
    expect(button("Roll D6")).toBeDisabled();
    expect(screen.getByLabelText("D6 rolled")).toBeDisabled();
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
