import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { pastedStats, StatBoxes } from "./stat-boxes";

const NINE = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
const TEN = [...NINE, "Sv"] as const;
const fields = (labels: readonly string[]) => labels.map((label) => ({ key: label, label }));

describe("pastedStats", () => {
  it("spreads a whole profile row pasted into the first box across the nine", () => {
    expect(pastedStats(NINE, 0, "4 3 3 3 3 1 3 1 7")).toEqual({
      M: "4",
      WS: "3",
      BS: "3",
      S: "3",
      T: "3",
      W: "1",
      I: "3",
      A: "1",
      Ld: "7",
    });
  });

  it("takes the save as a tenth value, or leaves it alone with nine", () => {
    expect(pastedStats(TEN, 0, "4\t3\t3\t3\t3\t1\t3\t1\t7\t5+")).toMatchObject({
      Ld: "7",
      Sv: "5+",
    });
    expect(pastedStats(TEN, 0, "4 3 3 3 3 1 3 1 7")).not.toHaveProperty("Sv");
  });

  it("drops what runs past the last box, and fills from the box pasted into", () => {
    expect(pastedStats(NINE, 0, "4 3 3 3 3 1 3 1 7 5+")).not.toHaveProperty("Sv");
    expect(pastedStats(NINE, 7, "2(4) 8 9")).toEqual({ A: "2(4)", Ld: "8" });
  });

  it("keeps written values as they are, and leaves a single value to paste as usual", () => {
    expect(pastedStats(NINE, 0, " D6  2(4) 3+ - ")).toEqual({
      M: "D6",
      WS: "2(4)",
      BS: "3+",
      S: "-",
    });
    expect(pastedStats(NINE, 0, "2(4)")).toBeNull();
    expect(pastedStats(NINE, 0, "  ")).toBeNull();
  });
});

function Row({ start = {} }: { start?: Record<string, string> }) {
  const [values, setValues] = useState<Partial<Record<string, string>>>(start);
  return (
    <StatBoxes
      fields={fields(TEN)}
      values={values}
      name={(label) => `${label} for Ulric`}
      onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
    />
  );
}

describe("StatBoxes", () => {
  it("is ten type boxes with no steppers, each taking a number or a written value", async () => {
    render(<Row />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    await userEvent.type(screen.getByLabelText("A for Ulric"), "2(4)");
    expect(screen.getByLabelText("A for Ulric")).toHaveValue("2(4)");
    expect(screen.getAllByRole("textbox")).toHaveLength(10);
  });

  it("spreads a row pasted into the first box across the boxes", () => {
    render(<Row start={{ Sv: "6+" }} />);

    fireEvent.paste(screen.getByLabelText("M for Ulric"), {
      clipboardData: { getData: () => "4 3 3 3 3 1 3 1 7" },
    });

    const shown = TEN.map(
      (label) => (screen.getByLabelText(`${label} for Ulric`) as HTMLInputElement).value
    );
    expect(shown).toEqual(["4", "3", "3", "3", "3", "1", "3", "1", "7", "6+"]);
  });
});
