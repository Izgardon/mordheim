/**
 * The dice panel's controls on a phone (William, 12 Nov: "dice roller looks bad on mobile"). The
 * eight die chips used to share one flex row with both steppers, which squeezed them to mush at
 * 390px, and neither stepper showed which number it held. A unit test can't measure overlap, so
 * this asserts the shape that caused it: the die group holds all eight dice, and each of the three
 * groups is labelled where the player can read it, not only for a screen reader.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import DicePanel from "./DicePanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/stores/app-store", () => ({ useAppStore: () => ({ warband: null }) }));

beforeEach(() => {
  fakeApi.reset();
});

const renderPanel = () =>
  renderWithQueryClient(<DicePanel campaignId={1} open onOpenChange={() => undefined} />);

describe("DicePanel", () => {
  it("keeps all eight dice in their own group", () => {
    renderPanel();
    const dice = within(screen.getByRole("group", { name: "Die" })).getAllByRole("button");
    expect(dice.map((chip) => chip.textContent)).toEqual([
      "D3",
      "D6",
      "D8",
      "D10",
      "D12",
      "D20",
      "D66",
      "D100",
    ]);
  });

  it("names the die group and both steppers on the panel itself", () => {
    renderPanel();
    const captions = Array.from(document.body.querySelectorAll("span")).map(
      (node) => node.textContent
    );
    expect(captions).toContain("Die");
    expect(captions).toContain("Dice");
    expect(captions).toContain("Modifier");
  });
});
