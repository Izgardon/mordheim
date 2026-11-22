/**
 * Camp's blood pacts: a 2D6 per hired sword, rolled or typed in (William, 5 Nov 2026: "this is the
 * entire vibe of the app"), his +1 per advance counted in, a 12 swearing the pact and anything else
 * warning rather than refusing. The rule itself is there to read.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDie } from "@/lib/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import BloodPactRows from "./BloodPactRows";
import type { PactLine } from "./blood-pacts";
import type { OpenCamp } from "./camp-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const camp = { warbandId: 7, isMobile: false } as unknown as OpenCamp;
const line: PactLine = { id: 3, name: "Grukk", bonus: 2 };

const show = (lines: PactLine[] = [line]) =>
  renderWithQueryClient(<BloodPactRows camp={camp} lines={lines} />);

const type = async (user: ReturnType<typeof setupUser>, first: string, second: string) => {
  await user.type(screen.getByLabelText("First D6 rolled"), first);
  await user.keyboard(second);
};

beforeEach(() => {
  fakeApi.reset();
  vi.mocked(rollDie).mockReset();
});

describe("BloodPactRows", () => {
  it("shows his bonus and swears the pact on a typed 12", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /warbands/7/hirelings/3/", { id: 3, blood_pacted: true });
    show();
    expect(screen.getByText("+2 for advances gained")).toBeVisible();

    await type(user, "5", "5"); // 10 on the dice, 12 with his bonus

    expect(screen.getByText("12 · they swear the pact")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Form the pact" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("PATCH /warbands/7/hirelings/3/")).toEqual({ blood_pacted: true })
    );
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("warns on anything else but still lets the pact be formed", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /warbands/7/hirelings/3/", { id: 3, blood_pacted: true });
    show();

    await type(user, "3", "4"); // 7 on the dice, 9 with his bonus

    expect(screen.getByText("9 · 12 forms a pact")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Form the pact" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("PATCH /warbands/7/hirelings/3/")).toEqual({ blood_pacted: true })
    );
  });

  it("rolls the same 2D6 the table would", async () => {
    const user = setupUser();
    vi.mocked(rollDie).mockReturnValueOnce(6).mockReturnValueOnce(4);
    show([{ ...line, bonus: 0 }]);

    await user.click(screen.getByRole("button", { name: "2D6" }));

    expect(screen.getByText("10 · 12 forms a pact")).toBeVisible();
    expect(screen.queryByText("+0 for advances gained")).toBeNull();
  });

  it("keeps the rule where the player can read it", () => {
    show([]);

    expect(screen.getByText("Blood Pact")).toBeVisible();
    expect(
      screen.getByText(/Assassins, Thieves, Merchants, Fences and Slavers never form a pact\./)
    ).toBeInTheDocument();
  });
});
