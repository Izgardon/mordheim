/**
 * Choose a plot on the warband page's campaign points row (William, 28 Nov 2026: "If not plot
 * selected then we need a way to choose plot from here, otherwise we dont"): the campaign's plots
 * in a modal (a bottom sheet on a phone), saved through the warband PATCH, the sheet alone read
 * again. A plot whose setting isn't ticked is greyed with the warning and still chosen.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import PlotChooser from "./PlotChooser";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const PLOTS = [
  {
    id: 4,
    name: "Drowning the Witch",
    who_text: "Witch Hunters and Sisters of Sigmar.",
    setting_id: 1,
    in_play: true,
  },
  { id: 5, name: "The Sunken Temple", who_text: "", setting_id: 6, in_play: false },
];

const show = () => renderWithQueryClient(<PlotChooser campaignId={7} warbandId={9} />);
const choose = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getByRole("button", { name: "Choose a plot" }));
  return screen.findByRole("dialog", { name: "Choose a plot" });
};

describe("choosing a plot on the warband page", () => {
  beforeEach(() => {
    fakeApi.reset();
    vi.mocked(toast.warning).mockClear();
    fakeApi.on("GET /campaigns/7/plots/", PLOTS);
    fakeApi.on("GET /settings/", {
      settings: [
        { id: 1, name: "Mordheim 1a" },
        { id: 6, name: "Lustria" },
      ],
      presets: [],
    });
    fakeApi.on("PATCH /warbands/9/", (body: unknown) => ({ id: 9, ...(body as object) }));
  });

  it("reads the campaign's plots only once opened", async () => {
    const user = setupUser();
    show();

    expect(fakeApi.calls()).not.toContain("GET /campaigns/7/plots/");
    const dialog = await choose(user);

    const rows = await within(dialog).findAllByRole("option");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Witch Hunters and Sisters of Sigmar.")).toBeVisible();
  });

  it("saves the plot picked through the warband PATCH and reads only the sheet again", async () => {
    const user = setupUser();
    const { queryClient } = show();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const dialog = await choose(user);

    await user.click(await within(dialog).findByRole("option", { name: /Drowning the Witch/ }));

    await waitFor(() => expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ plot_id: 4 }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(invalidate.mock.calls).toEqual([[{ queryKey: queryKeys.campaign.warbandSheet(7, 9) }]]);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("greys a plot out of play with the warning, and still chooses it, warning again", async () => {
    const user = setupUser();
    show();
    const dialog = await choose(user);

    const row = await within(dialog).findByRole("option", { name: /The Sunken Temple/ });
    expect(within(row).getByText("Lustria isn't in this campaign")).toBeVisible();
    await user.click(row);

    await waitFor(() => expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ plot_id: 5 }));
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Lustria isn't in this campaign")
    );
  });

  it("keeps the list open and says why when the save is refused", async () => {
    const user = setupUser();
    fakeApi.fail(
      "PATCH /warbands/9/",
      new Error("That isn't one of the plots this campaign plays with.")
    );
    show();
    const dialog = await choose(user);

    await user.click(await within(dialog).findByRole("option", { name: /Drowning the Witch/ }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That isn't one of the plots this campaign plays with."
    );
  });

  it("says so when the campaign has no plots", async () => {
    const user = setupUser();
    fakeApi.on("GET /campaigns/7/plots/", []);
    show();
    const dialog = await choose(user);

    expect(await within(dialog).findByText("This campaign has no plots.")).toBeVisible();
  });
});
