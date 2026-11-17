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
function Paying({ onPaid, paying = fee }: { onPaid: (payment: Payment) => void; paying?: Fee }) {
  const [payment, setPayment] = useState(() => paymentOf(paying));
  return (
    <FeePayment
      fee={paying}
      payment={payment}
      onChange={(next) => {
        setPayment(next);
        onPaid(next);
      }}
      counters={[{ id: 1, name: "Campaign points", amount: 9 }]}
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

  // William, 16 Nov 2026: campaign points are a number on the warband, so the player pays them
  it("shows a campaign points line as words, with nothing to pay it from", () => {
    const paying: Fee = {
      ...fee,
      dice: null,
      dice_multiplier: null,
      resources: [
        {
          resource: "Campaign points",
          amount: 5,
          names: ["campaign points"],
          campaign_points: true,
        },
      ],
    };
    render(<Paying onPaid={vi.fn()} paying={paying} />);

    expect(screen.getByText("5 Campaign points")).toBeVisible();
    expect(screen.getByText(/yours to take off the warband's total/)).toBeVisible();
    expect(screen.queryByLabelText("What pays Campaign points")).toBeNull();
  });
});
