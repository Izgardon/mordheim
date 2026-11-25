/** The mount line's switch (William, 25 Nov 2026): on and "Mounted" while he rides, off and "Dismounted" on foot. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import { battleRosters, ME } from "@/test/battle-fixtures";
import { setupUser } from "@/test/user-event";

import { unitView } from "./battle-units";
import UnitCard from "./UnitCard";

const rider = () => {
  const unit = toParticipantRosters(battleRosters())[ME.id].heroes[0];
  return { ...unit, mount: { ...(unit.mount ?? {}), name: "Warhorse" } } as typeof unit;
};

const show = (dismounted: boolean, onDismount = vi.fn()) =>
  render(
    <UnitCard
      view={unitView(rider(), { dismounted } as never)}
      typeLine="Captain"
      onOpen={vi.fn()}
      actions={{
        canAct: true,
        saving: false,
        onCycle: vi.fn(),
        onWounds: vi.fn(),
        onDismount,
        onNote: vi.fn(),
      }}
    />
  );

describe("the battle card's mount switch", () => {
  it("is on and reads Mounted while he rides, and dismounts him when pressed", async () => {
    const onDismount = vi.fn();
    show(false, onDismount);
    const toggle = screen.getByRole("switch", { name: "Mounted" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await setupUser().click(toggle);
    expect(onDismount).toHaveBeenCalledWith(true);
  });

  it("is off and reads Dismounted on foot", () => {
    show(true);
    expect(screen.getByRole("switch", { name: "Dismounted" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
