import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UnitStatsGrid from "./UnitStatsGrid";

type TestUnit = {
  stats: Record<string, string>;
  armour_save: string;
};

function TestHarness() {
  const [unit, setUnit] = React.useState<TestUnit>({
    stats: {
      M: "",
      WS: "",
      BS: "",
    },
    armour_save: "",
  });

  return (
    <UnitStatsGrid
      unit={unit}
      index={0}
      statFields={["M", "WS", "BS"]}
      inputClassName=""
      onUpdate={(_, updater) => setUnit((current) => updater(current))}
    />
  );
}

describe("UnitStatsGrid", () => {
  it("distributes spreadsheet-style pasted values across subsequent stat inputs", () => {
    render(<TestHarness />);

    const inputs = screen.getAllByPlaceholderText("-");
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => "4\t3\t2\t6",
      },
    });

    expect(inputs[0]).toHaveValue("4");
    expect(inputs[1]).toHaveValue("3");
    expect(inputs[2]).toHaveValue("2");
    expect(inputs[3]).toHaveValue(6);
  });

  it("can start the paste from a later stat field", () => {
    render(<TestHarness />);

    const inputs = screen.getAllByPlaceholderText("-");
    fireEvent.paste(inputs[1], {
      clipboardData: {
        getData: () => "5\t4\t3",
      },
    });

    expect(inputs[0]).toHaveValue("");
    expect(inputs[1]).toHaveValue("5");
    expect(inputs[2]).toHaveValue("4");
    expect(inputs[3]).toHaveValue(3);
  });
});
