/**
 * The plot picker (apps/plots): every option reads its name over the plot's own words on who may
 * follow it (William, 18 Nov 2026), nothing is greyed or warned about, and the plot is changed or
 * dropped for nothing.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import PlotSelect from "./PlotSelect";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const PLOTS = [
  { id: 4, name: "Drowning the Witch", who_text: "Witch Hunters and Sisters of Sigmar." },
  { id: 5, name: "The Shards", who_text: "Any warband." },
];

describe("the plot picker", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /campaigns/7/plots/", PLOTS);
  });

  it("gives every option its name and who may follow it underneath", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <PlotSelect campaignId={7} value={null} onChange={vi.fn()} id="pick-plot" />
    );

    await user.click(await screen.findByRole("combobox", { name: "Plot" }));
    const rows = within(screen.getByRole("listbox", { name: "Plot" })).getAllByRole("option");

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Drowning the Witch")).toBeVisible();
    expect(within(rows[0]).getByText("Witch Hunters and Sisters of Sigmar.")).toBeVisible();
    expect(within(rows[1]).getByText("The Shards")).toBeVisible();
    expect(within(rows[1]).getByText("Any warband.")).toBeVisible();
    // who_text is prose the player reads: no option is greyed and none carries a warning
    expect(rows.every((row) => row.getAttribute("aria-disabled") === null)).toBe(true);
  });

  it("picks a plot, changes it, and follows none again", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderWithQueryClient(<PlotSelect campaignId={7} value={null} onChange={onChange} />);

    await user.click(await screen.findByRole("combobox", { name: "Plot" }));
    await user.click(screen.getByRole("option", { name: /Drowning the Witch/ }));
    expect(onChange).toHaveBeenLastCalledWith(4);

    renderWithQueryClient(<PlotSelect campaignId={7} value={4} onChange={onChange} />);
    await user.click(await screen.findByRole("button", { name: "Plot: Drowning the Witch" }));
    await user.click(screen.getByRole("option", { name: /The Shards/ }));
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it("drops the plot it follows", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderWithQueryClient(<PlotSelect campaignId={7} value={4} onChange={onChange} />);

    await user.click(await screen.findByRole("button", { name: "No plot" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
