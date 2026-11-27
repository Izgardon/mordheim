/**
 * Settings → Rules → Main resource: the default resource's name and its sell prices, folded under
 * the name. William, 23 Nov 2026: "If a setting is selected other than Mordheim then the default
 * resource name input setting shouldn't appear".
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import ResourceSection from "./ResourceSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const campaign = campaignSummary({ default_resource_name: "Wyrdstone" });

const show = async () => {
  renderWithQueryClient(<ResourceSection campaign={campaign} />);
  const fold = screen.getByRole("button", { name: /^Main resource/ });
  expect(fold).toHaveTextContent("Wyrdstone and its sell prices");
  await setupUser().click(fold);
};

beforeEach(() => fakeApi.reset());

describe("Main resource", () => {
  it("asks for a name while no published campaign names it", async () => {
    await show();
    expect(screen.getByRole("textbox", { name: "Default resource" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save prices" })).toBeInTheDocument();
  });

  it("leaves the name out once the published campaign names the main resource", async () => {
    fakeApi.on(`GET /campaigns/${campaign.id}/preset/`, {
      preset_id: 3,
      preset_name: "Mutiny in Marienburg",
      sets: [
        {
          field: "default_resource_name",
          label: "Main resource",
          value: "Treasure",
          text: "Treasure",
          departure: "",
        },
      ],
      departures: [],
    });
    await show();

    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Default resource" })).not.toBeInTheDocument()
    );
  });
});
