import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ME, myParticipant, OPPONENT, opponentParticipant } from "@/test/battle-fixtures";

import RoundSheet from "./RoundSheet";

const request = { round: 2, asked_by: ME.id, agreed: [ME.id] };

function renderAsked(canForce: boolean) {
  const onAction = vi.fn().mockResolvedValue(undefined);
  render(
    <RoundSheet
      mode="asked"
      round={1}
      request={request}
      participants={[
        myParticipant({ status: "in_battle" }),
        opponentParticipant({ status: "in_battle" }),
      ]}
      neutralGroups={[]}
      userId={ME.id}
      canForce={canForce}
      onOpenChange={vi.fn()}
      onNotYet={vi.fn()}
      onAction={onAction}
    />
  );
  return onAction;
}

describe("RoundSheet", () => {
  it("offers Start anyway to the battle's creator or a battle manager", () => {
    renderAsked(true);

    expect(screen.getByRole("button", { name: "Start anyway" })).toBeInTheDocument();
    expect(screen.getByText(OPPONENT.label)).toBeInTheDocument();
  });

  it("hides Start anyway from the other players, who wait for everyone to agree (William)", () => {
    renderAsked(false);

    expect(screen.queryByRole("button", { name: "Start anyway" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep waiting" })).toBeInTheDocument();
    expect(screen.getByText(/creator or a battle manager can start it anyway/)).toBeInTheDocument();
  });
});
