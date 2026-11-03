/**
 * Settings → Warband rules' Default resource: the campaign's name for every warband's default
 * resource, renamed with one PATCH; a rename that merged shows the server's warning.
 */
import { screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { queryKeys } from "@/lib/query-keys";

import DefaultResource from "./DefaultResource";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const campaign = campaignSummary({ default_resource_name: "Wyrdstone" });
const warning = {
  code: "default_resource_merged",
  message: "Rats already had Warpstone: merged into the default resource.",
};

beforeEach(() => {
  fakeApi.reset();
  vi.mocked(toast.warning).mockClear();
});

describe("Default resource", () => {
  it("shows the campaign's name and renames it for every warband", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: { default_resource_name: string }) => ({
      ...campaign,
      default_resource_name: body.default_resource_name,
      warnings: [warning],
    }));
    const { queryClient } = renderWithQueryClient(<DefaultResource campaign={campaign} />);
    queryClient.setQueryData(queryKeys.campaign.detail(campaign.id), campaign);
    const field = screen.getByRole("textbox", { name: "Default resource" });
    expect(field).toHaveValue("Wyrdstone");
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();

    await user.clear(field);
    await user.type(field, " Warpstone ");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /campaigns/${campaign.id}/`)).toEqual({
        default_resource_name: "Warpstone",
      })
    );
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(warning.message, expect.anything())
    );
    const cached = queryClient.getQueryData<typeof campaign>(
      queryKeys.campaign.detail(campaign.id)
    );
    expect(cached?.default_resource_name).toBe("Warpstone");
    expect(cached).not.toHaveProperty("warnings");
  });

  it("never sends a blank name", async () => {
    const user = setupUser();
    renderWithQueryClient(<DefaultResource campaign={campaign} />);

    await user.clear(screen.getByRole("textbox", { name: "Default resource" }));
    await user.type(screen.getByRole("textbox", { name: "Default resource" }), "   ");

    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    expect(fakeApi.calls()).toEqual([]);
  });
});
