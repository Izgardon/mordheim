/**
 * The campaign's Encampments page (William, 24 Nov 2026), on the real routes over the fake API: the
 * holding rules first, each opening its own modal; then a row per group, opening to its
 * encampments, each saying who holds it, opening to how it is gained and what it gives, with Take
 * it, Raze it and Give it up as the server allows. Those with `manage_encampments` add, edit and
 * remove groups and encampments.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignFor } from "@/test/campaign-fixtures";
import {
  holdingRule,
  makeEncampment,
  makeEncampmentGroup,
  makeEncampmentsPage,
} from "@/test/encampment-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/campaigns/routes/Encampments";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/encampments`;
const GROUPS = `/campaigns/${CAMPAIGN_ID}/encampment-groups/`;
const CAMPS = `/campaigns/${CAMPAIGN_ID}/encampments/`;

const openAs = (role: "owner" | "player", enable_encampments = true, path = PAGE) => {
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor(role, { enable_encampments }));
  return renderApp(path);
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${GROUPS}`, makeEncampmentsPage());
});

afterEach(() => {
  cleanupApps();
});

describe("The Encampments page", () => {
  it("shows the holding rules, then each group's encampments and who holds them", async () => {
    const user = setupUser();
    openAs("player");

    await user.click(await screen.findByRole("button", { name: /Holding an encampment/ }));
    expect(await screen.findByText("An encampment is held until it is razed.")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /Marienburg city/ }));
    expect(screen.getByText("Inside the walls.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tavern/ })).toHaveTextContent("Nobody's");
    const fort = screen.getByRole("button", { name: /Old Fort/ });
    expect(fort).toHaveTextContent("Fortified");
    expect(fort).toHaveTextContent("Held by Rats");
    expect(screen.queryByRole("button", { name: /^(Add|Edit|Remove)/ })).toBeNull();

    await user.click(fort);
    expect(screen.getByText("Exploration 11111")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raze it" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Give it up" })).toBeNull();
  });

  it("takes one for your warband and shows the server's warning", async () => {
    const user = setupUser();
    const warning = "Rats held Old Fort: the book has you play Stockade for it first.";
    fakeApi.on(`POST ${CAMPS}5/take/`, () => ({
      encampment: makeEncampment({
        id: 5,
        name: "Old Fort",
        fortified: true,
        holder: { id: 3, name: "Monks", player: "Raider" },
        capabilities: { take: true, raze: true, give_up: true },
      }),
      warnings: [{ code: "encampment_taken_from", message: warning }],
    }));
    openAs("player");

    await user.click(await screen.findByRole("button", { name: /Marienburg city/ }));
    await user.click(screen.getByRole("button", { name: /Old Fort/ }));
    await user.click(screen.getByRole("button", { name: "Take it" }));

    expect(await screen.findByText(warning)).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${CAMPS}5/take/`)).toEqual({ warband_id: 3 });
    expect(screen.getByRole("button", { name: /Old Fort/ })).toHaveTextContent("Held by Monks");
    expect(screen.getByRole("button", { name: "Give it up" })).toBeInTheDocument();
  });

  it("offers no Take it where the server says there is nothing to take it for", async () => {
    const user = setupUser();
    const mine = makeEncampment({
      holder: { id: 3, name: "Monks", player: "Raider" },
      capabilities: { take: false, raze: true, give_up: true },
    });
    fakeApi.on(
      `GET ${GROUPS}`,
      makeEncampmentsPage({ groups: [makeEncampmentGroup({ encampments: [mine] })] })
    );
    openAs("player");

    await user.click(await screen.findByRole("button", { name: /Marienburg city/ }));
    await user.click(screen.getByRole("button", { name: /Tavern/ }));

    expect(screen.queryByRole("button", { name: /^Take it/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Raze it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Give it up" })).toBeInTheDocument();
  });

  it("picks which warband takes it when you may take for several", async () => {
    const user = setupUser();
    fakeApi.on(
      `GET ${GROUPS}`,
      makeEncampmentsPage({
        takers: [
          { id: 3, name: "Monks", mine: true },
          { id: 9, name: "Rats", mine: false },
          { id: 11, name: "Ghouls", mine: false },
        ],
      })
    );
    fakeApi.on(`POST ${CAMPS}4/take/`, () => ({
      encampment: makeEncampment({ holder: { id: 11, name: "Ghouls", player: "Gil" } }),
      warnings: [],
    }));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: /Marienburg city/ }));
    await user.click(screen.getByRole("button", { name: /^Tavern/ }));
    await user.selectOptions(screen.getByLabelText("Take it for"), "11");
    await user.click(screen.getByRole("button", { name: "Take it" }));

    await waitFor(() => expect(fakeApi.bodyOf(`POST ${CAMPS}4/take/`)).toEqual({ warband_id: 11 }));
  });

  it("razes one after a confirm that says who loses it", async () => {
    const user = setupUser();
    const held = makeEncampmentGroup({
      encampments: [
        makeEncampment({
          holder: { id: 3, name: "Monks", player: "Raider" },
          capabilities: { take: true, raze: true, give_up: true },
        }),
      ],
    });
    fakeApi.on(`GET ${GROUPS}`, makeEncampmentsPage({ groups: [held] }));
    fakeApi.on(`POST ${CAMPS}4/raze/`, () => ({
      encampment: makeEncampment({ razed: true }),
      warnings: [],
    }));
    openAs("player");

    await user.click(await screen.findByRole("button", { name: /Marienburg city/ }));
    await user.click(screen.getByRole("button", { name: /Tavern/ }));
    await user.click(screen.getByRole("button", { name: "Raze it" }));
    const confirm = await screen.findByRole("dialog", { name: "Raze it" });
    expect(confirm).toHaveTextContent("Raze Tavern? Monks no longer holds it.");
    await user.click(within(confirm).getByRole("button", { name: "Raze it" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tavern/ })).toHaveTextContent("Razed")
    );
  });

  it("lets one who manages encampments add a group and an encampment", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${GROUPS}`, (body: object) => ({
      ...makeEncampmentGroup(),
      ...body,
      id: 9,
      encampments: [],
    }));
    fakeApi.on(`POST ${CAMPS}`, (body: object) => ({ ...makeEncampment(), ...body, id: 12 }));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: "Add group" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a group" });
    await user.type(within(dialog).getByLabelText("Name"), "Outside the city");
    await user.click(within(dialog).getByRole("button", { name: "Add group" }));
    expect(await screen.findByRole("button", { name: /Outside the city/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Marienburg city/ }));
    await user.click(screen.getByRole("button", { name: "Add encampment" }));
    const form = await screen.findByRole("dialog", { name: "Add an encampment" });
    await user.type(within(form).getByLabelText("Name"), "Windmill");
    await user.type(within(form).getByLabelText("Gained by"), "Exploration 66");
    await user.click(within(form).getByRole("switch", { name: "Fortified" }));
    await user.click(within(form).getByRole("button", { name: "Add encampment" }));

    expect(await screen.findByRole("button", { name: /Windmill/ })).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${CAMPS}`)).toEqual({
      group_id: 2,
      name: "Windmill",
      gained_by: "Exploration 66",
      fortified: true,
      text: "",
    });
  });

  it("lets its owner add a holding rule, sent as an encampment rule", async () => {
    const user = setupUser();
    fakeApi.on(`POST /campaigns/${CAMPAIGN_ID}/campaign-rules/`, (body: object) => ({
      ...holdingRule,
      ...body,
      id: 41,
    }));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: "Add encampment rule" }));
    const form = screen.getByRole("form", { name: "Add an encampment rule" });
    await user.type(within(form).getByLabelText("Title"), "Rebuilding");
    await user.click(within(form).getByRole("button", { name: "Add rule" }));

    expect(await screen.findByRole("heading", { name: "Rebuilding" })).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST /campaigns/${CAMPAIGN_ID}/campaign-rules/`)).toMatchObject({
      title: "Rebuilding",
      kind: "encampment",
    });
  });

  it("removes a group and its encampments after a confirm", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${GROUPS}2/`, null);
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: /Marienburg city/ }));
    await user.click(screen.getByRole("button", { name: "Remove group" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove the group" });
    expect(confirm).toHaveTextContent("Remove Marienburg city and its encampments?");
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Marienburg city/ })).toBeNull()
    );
  });

  it("opens the encampment a warband sheet's link names", async () => {
    openAs("player", true, `${PAGE}?open=5`);

    expect(await screen.findByText("Exploration 11111")).toBeInTheDocument();
    expect(screen.queryByText("Seaside Situations 53")).toBeNull();
  });

  it("reads the list again when another member changes an encampment", async () => {
    const user = setupUser();
    openAs("player");
    await user.click(await screen.findByRole("button", { name: /Marienburg city/ }));
    fakeApi.on(
      `GET ${GROUPS}`,
      makeEncampmentsPage({
        groups: [
          makeEncampmentGroup({
            encampments: [makeEncampment({ holder: { id: 9, name: "Rats", player: "Rex" } })],
          }),
        ],
      })
    );

    act(() =>
      fakeRealtime.emit(`private-campaign-${CAMPAIGN_ID}-events`, "encampments.changed", {})
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tavern/ })).toHaveTextContent("Held by Rats")
    );
  });

  it("says so while Encampments are switched off", async () => {
    openAs("owner", false);

    expect(
      await screen.findByText("Encampments are switched off for this campaign.")
    ).toBeInTheDocument();
    expect(fakeApi.calls()).not.toContain(`GET ${GROUPS}`);
  });
});
