/**
 * Home's Warbands and Warband lists (the workshop): each card's cost and code, Delete saying the
 * copies stay, Import by code (read first, then imported and opened), and a new warband from a
 * book type with its variant.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WorkshopRows } from "../types/workshop-types";
import WorkshopSections from "./WorkshopSections";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const ROWS: WorkshopRows = {
  warbands: [
    {
      id: 11,
      campaign_id: 11,
      warband_id: 40,
      name: "The Gilded Wagon",
      warband_type: { id: 3, name: "Reiklanders" },
      cost: 455,
      budget: 500,
      share_code: "WAGN2345",
      updated_at: "2026-11-25T10:00:00Z",
    },
    {
      id: 12,
      campaign_id: 12,
      warband_id: 41,
      name: "Overspent",
      warband_type: { id: 4, name: "Middenheimers" },
      cost: 620,
      budget: 500,
      share_code: "OVER2345",
      updated_at: "2026-11-25T10:00:00Z",
    },
  ],
  lists: [
    {
      id: 13,
      campaign_id: 13,
      template_id: 90,
      name: "Night Watch",
      warband_types: [{ id: 3, name: "Reiklanders" }],
      share_code: "WTCH2345",
      updated_at: "2026-11-25T10:00:00Z",
    },
  ],
};

const card = (name: string) => screen.getByRole("article", { name });

function renderHome() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/campaigns"]}>
      <Routes>
        <Route path="/campaigns" element={<WorkshopSections />} />
        <Route path="/workshop/:id" element={<p>Workshop page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /workshop/", ROWS);
  fakeApi.on("GET /settings/", { settings: [], presets: [] });
});

describe("Home's workshop sections", () => {
  it("lists my warbands with their cost against the budget and my lists with their types, each with its code", async () => {
    renderHome();

    expect(await screen.findByRole("article", { name: "The Gilded Wagon" })).toHaveTextContent(
      "Cost 455 / 500 gc"
    );
    expect(card("The Gilded Wagon")).toHaveTextContent("WAGN2345");
    expect(within(card("Overspent")).getByText("620 / 500 gc")).toHaveClass("text-danger");
    expect(card("Night Watch")).toHaveTextContent("Reiklanders");
    expect(within(card("Night Watch")).getByRole("link", { name: "Night Watch" })).toHaveAttribute(
      "href",
      "/workshop/13"
    );
  });

  it("deletes one after saying the copies elsewhere stay, and reads the list again", async () => {
    const user = setupUser();
    fakeApi.on("DELETE /workshop/11/", undefined);
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(
      within(card("The Gilded Wagon")).getByRole("button", { name: "Delete The Gilded Wagon" })
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Copies already imported into campaigns");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(fakeApi.countOf("GET /workshop/")).toBe(2));
    expect(fakeApi.calls()).toContain("DELETE /workshop/11/");
  });

  it("imports by code once the code is read, then opens what it made", async () => {
    const user = setupUser();
    fakeApi.on("GET /workshop/shared/ABCD2345/", {
      kind: "warband",
      share_code: "ABCD2345",
      maker: "Pia",
      name: "Pit Dogs",
      warband_type: { id: 4, name: "Middenheimers" },
      cost: 480,
      budget: 500,
      heroes: 3,
      henchmen: 7,
      hired_swords: 1,
    });
    fakeApi.on("POST /workshop/import/", {
      ...ROWS.warbands[0],
      id: 20,
      kind: "warband",
      warnings: [],
    });
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(screen.getAllByRole("button", { name: "Import by code" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Import by code" });
    expect(within(dialog).getByRole("button", { name: "Import" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Code"), "abcd-2345");

    expect(await within(dialog).findByText("Pit Dogs")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("3 heroes · 7 henchmen · 1 hired sword");
    await user.click(within(dialog).getByRole("button", { name: "Import" }));

    expect(await screen.findByText("Workshop page")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /workshop/import/")).toEqual({ code: "ABCD2345" });
  });

  it("shows the server's word on a code nobody has, and imports nothing", async () => {
    const user = setupUser();
    const detail = "No warband or warband list has that code.";
    fakeApi.fail(
      "GET /workshop/shared/ZZZZ2345/",
      new ApiError(detail, 404, { detail, code: "code_not_found", fields: {} })
    );
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(screen.getAllByRole("button", { name: "Import by code" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Import by code" });
    await user.type(within(dialog).getByLabelText("Code"), "ZZZZ2345");

    expect(await within(dialog).findByText(detail)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("makes a warband of a book type, asking for the variant its type doesn't preset", async () => {
    const user = setupUser();
    fakeApi.on("GET /warband-templates/", [
      {
        id: 5,
        campaign_id: null,
        setting_id: null,
        name: "Mercenaries",
        source: "Mordheim",
        variants: [
          { key: "reikland", name: "Reikland" },
          { key: "marienburg", name: "Marienburg" },
        ],
        types: [
          {
            id: 7,
            name: "Mercenaries",
            slug: "mercenaries",
            source_code: "MH",
            setting_id: null,
            campaign_id: null,
            variant: "",
            archived: false,
            in_play: null,
          },
        ],
      },
    ]);
    fakeApi.on("POST /workshop/warbands/", {
      ...ROWS.warbands[0],
      id: 21,
      kind: "warband",
      warnings: [],
    });
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(screen.getByRole("button", { name: "New warband" }));
    const dialog = screen.getByRole("dialog", { name: "New warband" });
    await user.type(within(dialog).getByLabelText("Name"), "Sellswords");
    await user.click(within(dialog).getByRole("combobox", { name: "Warband type" }));
    await user.click(await screen.findByRole("option", { name: /Mercenaries/ }));
    const make = within(dialog).getByRole("button", { name: "Make the warband" });
    expect(make).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Marienburg" }));
    await user.click(make);

    expect(await screen.findByText("Workshop page")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /workshop/warbands/")).toEqual({
      name: "Sellswords",
      warband_type_id: 7,
      template_variant: "marienburg",
    });
  });
  it("makes a warband from a list code, asking for the variant its type doesn't preset", async () => {
    const user = setupUser();
    fakeApi.on("GET /warband-templates/", []);
    fakeApi.on("GET /workshop/shared/WTCH2345/", {
      kind: "list",
      share_code: "WTCH2345",
      maker: "Pia",
      name: "Night Watch",
      warband_types: [{ id: 7, name: "Mercenaries", variant: "" }],
      variants: [
        { key: "reikland", name: "Reikland" },
        { key: "middenheim", name: "Middenheim" },
      ],
    });
    fakeApi.on("POST /workshop/warbands/", {
      ...ROWS.warbands[0],
      id: 22,
      kind: "warband",
      warnings: [],
    });
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(screen.getByRole("button", { name: "New warband" }));
    const dialog = screen.getByRole("dialog", { name: "New warband" });
    await user.type(within(dialog).getByLabelText("Name"), "Watchmen");
    await user.click(within(dialog).getByRole("button", { name: "A list code" }));
    await user.type(within(dialog).getByLabelText("List code"), "WTCH2345");
    await user.click(await within(dialog).findByRole("button", { name: "Middenheim" }));
    await user.click(within(dialog).getByRole("button", { name: "Make the warband" }));

    expect(await screen.findByText("Workshop page")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /workshop/warbands/")).toEqual({
      name: "Watchmen",
      list_code: "WTCH2345",
      warband_type_id: 7,
      template_variant: "middenheim",
    });
  });
});
