/**
 * The hire dialog's Paid button (William, 18 Nov 2026): a fee that charges nothing but asks for
 * something in words shows the server's words and a Paid button, which sends `fee_paid` so the
 * hire records what was settled; it moves no gold, and a fee in gold never shows one. A hire's
 * warnings are the server's words (a resource paid short among them).
 */
import { screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_ID } from "@/test/campaign-fixtures";
import { hiredSword } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import { blankFee } from "../fees";
import { HIRED_SWORDS } from "../hireling-catalogue-kinds";
import HireDialog from "./HireDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

const WARBAND = { id: 9, name: "The Reiklanders", resources: [], hero_count: 1, max_heroes: 6 };
const RELIC = "One holy or unholy relic.";

const show = (fee: Partial<ReturnType<typeof blankFee>>) => {
  const entry = hiredSword({ name: "Knight Panther", hire_fee: { ...blankFee(), ...fee } });
  renderWithQueryClient(
    <HireDialog
      config={HIRED_SWORDS}
      campaignId={CAMPAIGN_ID}
      warband={WARBAND}
      heroes={[]}
      entry={entry}
      onClose={vi.fn()}
    />
  );
  return entry;
};

describe("HireDialog", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on(`POST /warbands/9/hirelings/hire/`, { id: 31, name: "Knight Panther" });
  });

  it("records a fee nothing charges when Paid is pressed, and charges no gold", async () => {
    const user = setupUser();
    show({ kind: "special", note: RELIC, settle: RELIC });

    expect(screen.getByText(RELIC)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Paid" }));
    expect(screen.getByRole("button", { name: "Paid" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Hire for 0 gc" }));

    const route = "POST /warbands/9/hirelings/hire/";
    await waitFor(() => expect(fakeApi.countOf(route)).toBe(1));
    expect(fakeApi.bodyOf(route)).toMatchObject({ price: 0, fee_paid: true });
  });

  it("sends no Paid for a fee nothing charges until it is pressed", async () => {
    const user = setupUser();
    show({ kind: "special", note: RELIC, settle: RELIC });

    await user.click(screen.getByRole("button", { name: "Hire for 0 gc" }));

    const route = "POST /warbands/9/hirelings/hire/";
    await waitFor(() => expect(fakeApi.countOf(route)).toBe(1));
    expect(fakeApi.bodyOf(route)).not.toHaveProperty("fee_paid");
  });

  it("offers no Paid button for a fee in gold: it is charged and written already", () => {
    show({ gold: 80, settle: "" });

    expect(screen.queryByRole("button", { name: "Paid" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hire for 80 gc" })).toBeVisible();
  });

  it("shows the server's warning when the hire is paid short", async () => {
    const over = "Wyrdstone shards held 1: 1 of 2 Wyrdstone paid.";
    fakeApi.on(`POST /warbands/9/hirelings/hire/`, {
      id: 31,
      name: "Knight Panther",
      warnings: [{ code: "resource_short", message: over }],
    });
    const user = setupUser();
    show({ gold: 80, settle: "" });

    await user.click(screen.getByRole("button", { name: "Hire for 80 gc" }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(over, { id: "server-warning-resource_short" })
    );
  });
});
