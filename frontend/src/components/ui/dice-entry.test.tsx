import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDie, type Dice } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import DiceEntry, { boxName, boxText } from "./dice-entry";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const box = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

/** Boxes that stay beside a total the caller keeps, as a store price or a location's result. */
function Kept({ dice, start = null }: { dice: Dice; start?: number | null }) {
  const [total, setTotal] = useState<number | null>(start);
  return (
    <>
      <DiceEntry
        dice={dice}
        total={total}
        onFaces={(faces) => setTotal(faces.reduce((sum, face) => sum + face, 0))}
      />
      <output aria-label="Total">{total ?? "none"}</output>
      <button type="button" onClick={() => setTotal(5)}>
        Pick 5
      </button>
      <button type="button" onClick={() => setTotal(null)}>
        Clear
      </button>
    </>
  );
}

describe("boxName and boxText", () => {
  it("name each box for its die, in order when there are more", () => {
    expect(boxName([100], 0)).toBe("D100 rolled");
    expect(boxName([3], 0)).toBe("D3 rolled");
    expect([0, 1, 2].map((index) => boxName([6, 6, 6], index))).toEqual([
      "First D6 rolled",
      "Second D6 rolled",
      "Third D6 rolled",
    ]);
  });

  it("let a box hold only a number its die shows", () => {
    expect(boxText("4", 6, "")).toBe("4");
    expect(["7", "0", "x", "-"].map((typed) => boxText(typed, 6, ""))).toEqual(["", "", "", ""]);
    expect(boxText("4", 3, "")).toBe("");
    expect(boxText("45", 6, "4")).toBe("5");
    expect(boxText("54", 6, "4")).toBe("5");
    expect(boxText("47", 6, "4")).toBe("4");
    expect(boxText("100", 100, "10")).toBe("100");
    expect(boxText("101", 100, "10")).toBe("10");
    expect(boxText("05", 100, "")).toBe("");
  });
});

describe("DiceEntry", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("has a box per die: two for 2D6 and for a D66, one for a D100", () => {
    const { rerender } = render(<DiceEntry dice="2D6" onFaces={vi.fn()} />);
    expect(screen.getAllByRole("textbox").map((input) => input.getAttribute("aria-label"))).toEqual(
      ["First D6 rolled", "Second D6 rolled"]
    );
    rerender(<DiceEntry dice="D66" onFaces={vi.fn()} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    rerender(<DiceEntry dice="D100" onFaces={vi.fn()} />);
    expect(screen.getAllByRole("textbox").map((input) => input.getAttribute("aria-label"))).toEqual(
      ["D100 rolled"]
    );
  });

  it("rolls each die with the button and shows the faces in the boxes", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(3).mockReturnValueOnce(5);
    const onFaces = vi.fn();
    render(<DiceEntry dice="2D6" onFaces={onFaces} />);
    await setupUser().click(screen.getByRole("button", { name: "Roll 2D6" }));
    expect(rollDie).toHaveBeenCalledWith(6);
    expect(onFaces).toHaveBeenCalledWith([3, 5]);
    expect([box("First D6 rolled").value, box("Second D6 rolled").value]).toEqual(["3", "5"]);
  });

  it("gives typed faces once the last box is in, moving on from a full box", async () => {
    const onFaces = vi.fn();
    const onChange = vi.fn();
    render(<DiceEntry dice="D66" onFaces={onFaces} onChange={onChange} />);
    const user = setupUser();
    await user.type(box("First D6 rolled"), "3");
    expect(box("Second D6 rolled")).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith([3, null]);
    expect(onFaces).not.toHaveBeenCalled();
    await user.keyboard("6");
    expect(onFaces).toHaveBeenCalledTimes(1);
    expect(onFaces).toHaveBeenCalledWith([3, 6]);
    await user.keyboard("{Tab}");
    expect(onFaces).toHaveBeenCalledTimes(1);
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("takes only the die's numbers in a box, and a digit typed over a face replaces it", async () => {
    const onFaces = vi.fn();
    render(<DiceEntry dice="D3" onFaces={onFaces} />);
    const user = setupUser();
    await user.type(box("D3 rolled"), "7");
    await user.type(box("D3 rolled"), "0x");
    expect(box("D3 rolled")).toHaveValue("");
    expect(onFaces).not.toHaveBeenCalled();
    await user.type(box("D3 rolled"), "2");
    await user.type(box("D3 rolled"), "3");
    expect(box("D3 rolled")).toHaveValue("3");
    expect(onFaces.mock.calls).toEqual([[[2]], [[3]]]);
  });

  it("lets a D100 box wait for its second digit, or go on Enter or when left", async () => {
    const onFaces = vi.fn();
    const { unmount } = render(<DiceEntry dice="D100" onFaces={onFaces} />);
    const user = setupUser();
    await user.type(box("D100 rolled"), "4");
    expect(onFaces).not.toHaveBeenCalled();
    await user.keyboard("2");
    expect(onFaces).toHaveBeenLastCalledWith([42]);
    unmount();

    render(<DiceEntry dice="D100" onFaces={onFaces} />);
    await user.type(box("D100 rolled"), "7{Enter}");
    expect(onFaces).toHaveBeenLastCalledWith([7]);
    await user.clear(box("D100 rolled"));
    await user.type(box("D100 rolled"), "10");
    await user.keyboard("{Tab}");
    expect(onFaces).toHaveBeenLastCalledWith([10]);
    expect(onFaces).toHaveBeenCalledTimes(3);
  });

  it("goes back a box on Backspace in an empty one", async () => {
    render(<DiceEntry dice="2D6" onFaces={vi.fn()} />);
    const user = setupUser();
    await user.type(box("First D6 rolled"), "4");
    await user.keyboard("{Backspace}");
    expect(box("First D6 rolled")).toHaveFocus();
  });

  it("keeps the faces beside a total of theirs and follows a total of the caller's own", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(2).mockReturnValueOnce(6);
    const user = setupUser();
    render(<Kept dice="2D6" />);
    await user.click(screen.getByRole("button", { name: "Roll 2D6" }));
    expect(screen.getByLabelText("Total")).toHaveTextContent("8");
    expect(box("First D6 rolled")).toHaveValue("2");
    await user.type(box("First D6 rolled"), "5");
    expect(screen.getByLabelText("Total")).toHaveTextContent("11");
    expect([box("First D6 rolled").value, box("Second D6 rolled").value]).toEqual(["5", "6"]);
    await user.click(screen.getByRole("button", { name: "Pick 5" }));
    expect([box("First D6 rolled").value, box("Second D6 rolled").value]).toEqual(["", ""]);
  });

  it("shows a single die's total as its face, and empties on none", async () => {
    const user = setupUser();
    render(<Kept dice="D6" start={4} />);
    expect(box("D6 rolled")).toHaveValue("4");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(box("D6 rolled")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Pick 5" }));
    expect(box("D6 rolled")).toHaveValue("5");
  });

  it("draws the caller's button around the roll, or none", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(4);
    const onFaces = vi.fn();
    const { rerender } = render(
      <DiceEntry
        dice="D6"
        onFaces={onFaces}
        button={(roll) => (
          <button type="button" onClick={roll}>
            Advance
          </button>
        )}
      />
    );
    await setupUser().click(screen.getByRole("button", { name: "Advance" }));
    expect(onFaces).toHaveBeenCalledWith([4]);
    rerender(<DiceEntry dice="D6" onFaces={onFaces} button={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(box("D6 rolled")).toBeInTheDocument();
  });

  it("disables the button and the boxes", () => {
    render(<DiceEntry dice="2D6" disabled onFaces={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Roll 2D6" })).toBeDisabled();
    expect(box("First D6 rolled")).toBeDisabled();
  });
});
