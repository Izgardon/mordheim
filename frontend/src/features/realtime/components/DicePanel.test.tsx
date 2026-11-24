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
import { setupUser } from "@/test/user-event";
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

  it("has no row of preset rolls over the die chips (William, 20 Nov 2026)", () => {
    renderPanel();
    expect(screen.queryByRole("group", { name: "Quick rolls" })).toBeNull();
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

  // William, 24 Nov 2026: every roll can be typed in, on the main roller too
  it("takes the table's roll typed into a box per die, and shows its total", async () => {
    const user = setupUser();
    renderPanel();

    await user.type(screen.getByRole("textbox", { name: "First D6 rolled" }), "4");
    await user.type(screen.getByRole("textbox", { name: "Second D6 rolled" }), "5");

    expect(await screen.findByText("9")).toBeInTheDocument();
  });

  it("shows a roll's faces once, in the boxes, with the total beside them", async () => {
    const user = setupUser();
    // every die comes up 4
    vi.spyOn(crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint32Array) array[0] = 3;
        return array;
      }
    );
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Roll 2D6" }));

    expect(screen.getByRole("textbox", { name: "First D6 rolled" })).toHaveValue("4");
    expect(screen.getByRole("textbox", { name: "Second D6 rolled" })).toHaveValue("4");
    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(screen.queryByText("4")).toBeNull();
    vi.restoreAllMocks();
  });
});
