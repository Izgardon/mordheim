import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import type { Fee } from "../../fees";
import { paymentOf, type Payment } from "./fee-payment";
import FeePayment from "./FeePayment";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const fee: Fee = {
  kind: "gold",
  gold: 40,
  dice: 2,
  dice_multiplier: 10,
  resources: [],
  note: "",
};

/** The hire dialog's part: it keeps the payment. */
function Paying({ onPaid }: { onPaid: (payment: Payment) => void }) {
  const [payment, setPayment] = useState(() => paymentOf(fee));
  return (
    <FeePayment
      fee={fee}
      payment={payment}
      onChange={(next) => {
        setPayment(next);
        onPaid(next);
      }}
      counters={[]}
      onAddCounter={vi.fn()}
      idPrefix="hire"
    />
  );
}

describe("FeePayment", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("takes the fee's dice typed in, as the roll does, and keeps them beside Roll again", async () => {
    const user = setupUser();
    const onPaid = vi.fn();
    render(<Paying onPaid={onPaid} />);
    await user.type(screen.getByLabelText("First D6 rolled"), "2");
    await user.keyboard("5");
    expect(onPaid).toHaveBeenLastCalledWith({ gold: "110", roll: 7, lines: [] });
    expect(screen.getByLabelText("Gold paid")).toHaveValue(110);
    expect(screen.getByLabelText("Second D6 rolled")).toHaveValue("5");
    expect(rollDie).not.toHaveBeenCalled();

    vi.mocked(rollDie).mockReturnValueOnce(1).mockReturnValueOnce(1);
    await user.click(screen.getByRole("button", { name: "Roll again 2D6×10" }));
    expect(onPaid).toHaveBeenLastCalledWith({ gold: "60", roll: 2, lines: [] });
    expect(screen.getByLabelText("First D6 rolled")).toHaveValue("1");
  });
});
