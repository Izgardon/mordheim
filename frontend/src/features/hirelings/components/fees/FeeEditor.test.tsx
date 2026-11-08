/**
 * The hire fee and upkeep fields (William, 7 Nov 2026): gold and the dice unit on one line, one
 * "Add resource" that picks one of the campaign's resources and goes away, the line the fee reads
 * as, no hero's place for an upkeep, and a stored fee with several resources kept until Replace.
 */
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CampaignResource } from "@/features/campaigns/api/campaign-resources";
import { setupUser } from "@/test/user-event";

import { HIRE_KINDS, UPKEEP_KINDS, blankFee, type Fee, type FeeKind } from "../../fees";
import { feeDraftOf, feeFromDraft, feeWrite, type FeeDraft } from "./fee-draft";
import FeeEditor from "./FeeEditor";

const RESOURCES: CampaignResource[] = [
  { name: "Wyrdstone", is_default: true, is_campaign_points: false },
  { name: "Campaign points", is_default: false, is_campaign_points: true },
];

function Harness({
  fee,
  kinds = HIRE_KINDS,
  onDraft,
}: {
  fee?: Fee;
  kinds?: FeeKind[];
  onDraft?: (draft: FeeDraft) => void;
}) {
  const [draft, setDraft] = useState(() => feeDraftOf(fee ?? null, kinds));
  return (
    <FeeEditor
      label="Hire fee"
      reads="Hire"
      idPrefix="fee"
      kinds={kinds}
      resources={RESOURCES}
      value={draft}
      onChange={(next) => {
        setDraft(next);
        onDraft?.(next);
      }}
    />
  );
}

const reads = () => screen.getByText(/^Hire:/).textContent;

describe("FeeEditor", () => {
  it("takes the gold and the dice on one line and reads them back", async () => {
    const user = setupUser();
    render(<Harness />);
    await user.type(screen.getByRole("spinbutton", { name: "Hire fee gold" }), "30");
    await user.type(screen.getByRole("textbox", { name: "Hire fee dice: how many D6" }), "1");
    expect(reads()).toBe("Hire: 30 + D6 gc");
  });

  it("adds one of the campaign's resources once, and its × brings Add resource back", async () => {
    const user = setupUser();
    const onDraft = vi.fn();
    render(<Harness fee={{ ...blankFee(), gold: 30, dice: 1 }} onDraft={onDraft} />);

    await user.click(screen.getByRole("button", { name: "Add resource" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Wyrdstone",
      "Campaign points",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Wyrdstone" }));

    expect(screen.queryByRole("button", { name: "Add resource" })).not.toBeInTheDocument();
    expect(reads()).toBe("Hire: 30 + D6 gc and 1 Wyrdstone");
    const last = onDraft.mock.calls[onDraft.mock.calls.length - 1][0] as FeeDraft;
    expect(feeFromDraft(last).resources).toEqual([{ resource: "Wyrdstone", amount: 1 }]);

    await user.click(screen.getByRole("button", { name: "Remove Wyrdstone" }));
    expect(screen.getByRole("button", { name: "Add resource" })).toBeInTheDocument();
  });

  it("warns when the fee's resource is none of the campaign's", () => {
    render(<Harness fee={{ ...blankFee(), resources: [{ resource: "Treasure", amount: 2 }] }} />);
    expect(
      screen.getByText("Treasure isn't one of this campaign's resources.")
    ).toBeInTheDocument();
    expect(reads()).toBe("Hire: 2 Treasure");
  });

  it("never offers an upkeep a hero's place", () => {
    render(<Harness kinds={UPKEEP_KINDS} />);
    const kinds = screen.getAllByRole("option").map((option) => option.textContent);
    expect(kinds).toEqual(["A fee", "See his rules", "None"]);
  });

  it("asks how he is hired for a fee in his rules, and shows a fee's own note", async () => {
    const user = setupUser();
    render(<Harness fee={{ ...blankFee(), gold: 15, note: "15 gc*" }} />);
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("15 gc*");
    await user.selectOptions(screen.getByRole("combobox", { name: "Hire fee kind" }), "special");
    expect(screen.getByRole("textbox", { name: "How he is hired" })).toBeInTheDocument();
    expect(reads()).toBe("Hire: See his rules");
  });

  it("keeps a stored fee with several resources as it is until Replace", async () => {
    const user = setupUser();
    const onDraft = vi.fn();
    const fee: Fee = {
      ...blankFee(),
      gold: 20,
      resources: [
        { resource: "Treasure", amount: 2 },
        { resource: "Wyrdstone", amount: 1 },
      ],
    };
    render(<Harness fee={fee} onDraft={onDraft} />);
    expect(screen.getByText("20 gc + 2 Treasure + 1 Wyrdstone")).toBeInTheDocument();
    expect(feeWrite(feeDraftOf(fee))).toBeUndefined(); // left out of the write: the server keeps it

    await user.click(screen.getByRole("button", { name: "Replace" }));
    expect(reads()).toBe("Hire: 20 gc and 2 Treasure");
    const last = onDraft.mock.calls[onDraft.mock.calls.length - 1][0] as FeeDraft;
    expect(feeWrite(last)).toMatchObject({
      gold: 20,
      resources: [{ resource: "Treasure", amount: 2 }],
    });
  });
});
