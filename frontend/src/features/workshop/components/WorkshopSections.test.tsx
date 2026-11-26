/**
 * Home's workshop: its warbands and lists (each card's name, a warband's type under it, its code
 * and page), Delete saying campaigns keep their copy, My content (making the workshop on its first use), Import by code (read first,
 * imported with the server's warnings, opened), and a new warband from a book type, a list code,
 * one of my lists, with the type and variant each asks for, or no list (a type, a budget and most
 * warriors).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { Workshop } from "../types/workshop-types";
import WorkshopSections from "./WorkshopSections";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const ROWS: Workshop = {
  id: 9,
  warbands: [
    {
      id: 40,
      campaign_id: 9,
      name: "The Gilded Wagon",
      warband_type: { id: 3, name: "Reiklanders" },
      template_id: 5,
      no_list: false,
      cost: 455,
      budget: 500,
      share_code: "WAGN2345",
      updated_at: "2026-11-25T10:00:00Z",
    },
    {
      id: 41,
      campaign_id: 9,
      name: "Overspent",
      warband_type: { id: 4, name: "Middenheimers" },
      template_id: null,
      no_list: true,
      cost: 620,
      budget: 500,
      share_code: "OVER2345",
      updated_at: "2026-11-25T10:00:00Z",
    },
  ],
  lists: [
    {
      id: 90,
      campaign_id: 9,
      name: "Night Watch",
      warband_types: [
        { id: 3, name: "Reiklanders", variant: "" },
        { id: 7, name: "Mercenaries", variant: "" },
      ],
      variants: [
        { key: "reikland", name: "Reikland" },
        { key: "middenheim", name: "Middenheim" },
      ],
      share_code: "WTCH2345",
      updated_at: "2026-11-25T10:00:00Z",
    },
  ],
};

/** The book's Mercenaries template, serving its type, with two variants and no preset. */
const MERCENARIES = {
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
};

const card = (name: string) => screen.getByRole("article", { name });

function renderHome() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/campaigns"]}>
      <Routes>
        <Route path="/campaigns" element={<WorkshopSections />} />
        <Route path="/workshop/:id/*" element={<p>Workshop page</p>} />
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
  it("lists my warbands with their type under the name and my lists, each with its code", async () => {
    renderHome();

    const wagon = await screen.findByRole("article", { name: "The Gilded Wagon" });
    expect(wagon).toHaveTextContent("WAGN2345");
    // William, 26 Nov 2026: no cost on a card, the type under the name, and a list names no types
    expect(wagon).not.toHaveTextContent("Cost");
    expect(card("Overspent")).not.toHaveTextContent("620");
    const type = within(card("Overspent")).getByText("Middenheimers · No list");
    const title = within(card("Overspent")).getByRole("heading", { name: "Overspent" });
    expect(title.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card("Night Watch")).not.toHaveTextContent("Reiklanders");
    expect(card("Night Watch")).toHaveTextContent("WTCH2345");
    expect(card("The Gilded Wagon")).not.toHaveTextContent("No list");
    expect(
      within(card("The Gilded Wagon")).getByRole("link", { name: "The Gilded Wagon" })
    ).toHaveAttribute("href", "/workshop/9/warbands/40");
    expect(within(card("Night Watch")).getByRole("link", { name: "Night Watch" })).toHaveAttribute(
      "href",
      "/workshop/9/lists/90"
    );
    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute(
      "href",
      "/workshop/9/items"
    );
  });

  it("deletes a warband after saying campaigns keep their copy, and reads the workshop again", async () => {
    const user = setupUser();
    fakeApi.on("DELETE /warbands/40/", undefined);
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(
      within(card("The Gilded Wagon")).getByRole("button", { name: "Delete The Gilded Wagon" })
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("It's deleted for good. Campaigns it's in keep their copy.");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(fakeApi.countOf("GET /workshop/")).toBe(2));
    expect(fakeApi.calls()).toContain("DELETE /warbands/40/");
  });

  it("deletes a list through the catalogue's Delete", async () => {
    const user = setupUser();
    fakeApi.on("DELETE /warband-templates/90/", undefined);
    renderHome();
    await screen.findByRole("article", { name: "Night Watch" });

    await user.click(
      within(card("Night Watch")).getByRole("button", { name: "Delete Night Watch" })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(fakeApi.countOf("GET /workshop/")).toBe(2));
    expect(fakeApi.calls()).toContain("DELETE /warband-templates/90/");
  });

  it("makes my workshop on its first use, when My content opens before anything else", async () => {
    const user = setupUser();
    fakeApi.on("GET /workshop/", { id: null, warbands: [], lists: [] });
    fakeApi.on("POST /workshop/", { id: 9, warbands: [], lists: [] });
    renderHome();
    expect(await screen.findByText("No custom warbands yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Skills" }));

    expect(await screen.findByText("Workshop page")).toBeInTheDocument();
    expect(fakeApi.calls()).toContain("POST /workshop/");
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
      warnings: [
        { code: "custom_content_added", message: "Added: Lucky Charm.", names: ["Lucky Charm"] },
      ],
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
    expect(toast.warning).toHaveBeenCalledWith("Added: Lucky Charm.", {
      id: "server-warning-custom_content_added",
    });
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
    fakeApi.on("GET /warband-templates/", [MERCENARIES]);
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

  it("makes a warband from one of my lists, with the type and the variant it asks for", async () => {
    const user = setupUser();
    fakeApi.on("GET /warband-templates/", []);
    fakeApi.on("POST /workshop/warbands/", {
      ...ROWS.warbands[0],
      id: 23,
      kind: "warband",
      warnings: [],
    });
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(screen.getByRole("button", { name: "New warband" }));
    const dialog = screen.getByRole("dialog", { name: "New warband" });
    await user.type(within(dialog).getByLabelText("Name"), "Lamplighters");
    await user.click(within(dialog).getByRole("button", { name: "One of my lists" }));
    await user.click(within(dialog).getByRole("combobox", { name: "List" }));
    await user.click(await screen.findByRole("option", { name: /Night Watch/ }));
    await user.click(within(dialog).getByRole("button", { name: "Mercenaries" }));
    await user.click(within(dialog).getByRole("button", { name: "Reikland" }));
    await user.click(within(dialog).getByRole("button", { name: "Make the warband" }));

    expect(await screen.findByText("Workshop page")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /workshop/warbands/")).toEqual({
      name: "Lamplighters",
      list_id: 90,
      warband_type_id: 7,
      template_variant: "reikland",
    });
  });

  it("makes a warband with no list: a type, its budget and most warriors, and no variant", async () => {
    const user = setupUser();
    fakeApi.on("GET /warband-templates/", [MERCENARIES]);
    fakeApi.on("POST /workshop/warbands/", {
      ...ROWS.warbands[0],
      id: 24,
      template_id: null,
      kind: "warband",
      warnings: [],
    });
    renderHome();
    await screen.findByRole("article", { name: "The Gilded Wagon" });

    await user.click(screen.getByRole("button", { name: "New warband" }));
    const dialog = screen.getByRole("dialog", { name: "New warband" });
    await user.type(within(dialog).getByLabelText("Name"), "Freebooters");
    await user.click(within(dialog).getByRole("button", { name: "No list" }));
    await user.click(within(dialog).getByRole("combobox", { name: "Warband type" }));
    await user.click(await screen.findByRole("option", { name: /Mercenaries/ }));
    expect(within(dialog).queryByRole("group", { name: "Variant" })).not.toBeInTheDocument();
    const budget = within(dialog).getByLabelText("Budget (gc)");
    expect(budget).toHaveValue(500);
    expect(within(dialog).getByLabelText("Most warriors")).toHaveValue(15);
    await user.clear(budget);
    const make = within(dialog).getByRole("button", { name: "Make the warband" });
    expect(make).toBeDisabled();
    await user.type(budget, "350");
    await user.click(make);

    expect(await screen.findByText("Workshop page")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /workshop/warbands/")).toEqual({
      name: "Freebooters",
      warband_type_id: 7,
      no_list: true,
      budget: 350,
      max_units: 15,
    });
  });
});
