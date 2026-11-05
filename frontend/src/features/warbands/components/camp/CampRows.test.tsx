import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import CampRows from "./CampRows";
import type { OpenCamp } from "./camp-types";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const draft = { unit_results: {}, upkeep: { pay_upkeep: true, entries: {} }, camp: {} };

const show = (camp: Partial<OpenCamp> = {}) => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <CampRows
      camp={
        {
          draft,
          save,
          gold: 120,
          hirelings: [],
          campaign: null,
          bought: false,
          focus: null,
          isMobile: false,
          ...camp,
        } as unknown as OpenCamp
      }
      onSell={vi.fn()}
      onRecruit={vi.fn()}
    />
  );
  return save;
};

describe("CampRows", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("takes the veterans' 2D6 typed in, as the roll does", async () => {
    const user = setupUser();
    const save = show();
    await user.type(screen.getByLabelText("First D6 rolled"), "5");
    await user.keyboard("3");
    expect(save).toHaveBeenCalledWith({ ...draft, camp: { veterans: { dice: [5, 3], spent: 0 } } });
    expect(rollDie).not.toHaveBeenCalled();

    vi.mocked(rollDie).mockReturnValueOnce(5).mockReturnValueOnce(3);
    await user.click(screen.getByRole("button", { name: "2D6" }));
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  });

  it("offers Recruit once the pool is rolled", () => {
    show({ draft: { ...draft, camp: { veterans: { dice: [5, 3], spent: 2 } } } as never });
    expect(screen.getByText("6 XP available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recruit" })).toBeInTheDocument();
    expect(screen.queryByLabelText("First D6 rolled")).toBeNull();
  });
});
