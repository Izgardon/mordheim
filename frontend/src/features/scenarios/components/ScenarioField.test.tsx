import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { HUNT, POOL } from "@/test/scenario-fixtures";
import { setupUser } from "@/test/user-event";

import ScenarioField, { type ScenarioPick } from "./ScenarioField";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const LIST = "/campaigns/7/scenarios/";
let picked: ScenarioPick = { name: "", scenarioId: null };

function Harness() {
  const [value, setValue] = useState<ScenarioPick>({ name: "", scenarioId: null });
  picked = value;
  return <ScenarioField campaignId={7} value={value} onChange={setValue} />;
}

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(`GET ${LIST}`, [HUNT, POOL]);
});

describe("Start a battle's scenario", () => {
  it("picks one of the campaign's scenarios, each with its icon", async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);

    await user.click(screen.getByRole("combobox", { name: "Scenario" }));
    const listbox = screen.getByRole("listbox", { name: "Scenario" });
    const pool = await within(listbox).findByRole("option", { name: /The Pool/ });
    expect(within(pool).getByRole("img", { name: "Multiplayer" })).toBeInTheDocument();
    await user.click(within(listbox).getByRole("option", { name: /Wyrdstone Hunt/ }));

    expect(picked).toEqual({ name: "Wyrdstone Hunt", scenarioId: 11 });
    expect(screen.getByRole("button", { name: /Scenario: Wyrdstone Hunt/ })).toBeInTheDocument();
  });

  it("still takes a typed name, with no scenario", async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);

    await user.type(screen.getByRole("combobox", { name: "Scenario" }), "Bridge fight");
    expect(picked).toEqual({ name: "Bridge fight", scenarioId: null });
    await user.click(screen.getByRole("option", { name: "Play “Bridge fight”" }));
    expect(screen.getByRole("button", { name: "Scenario: Bridge fight" })).toBeInTheDocument();
  });

  it("draws one from the whole list, whoever plays, and draws again in its place", async () => {
    const user = setupUser();
    const answers = [POOL, HUNT];
    fakeApi.on(`POST ${LIST}random/`, () => answers.shift());
    renderWithQueryClient(<Harness />);

    await user.click(screen.getByRole("button", { name: "Random scenario" }));
    await waitFor(() => expect(picked).toEqual({ name: "The Pool", scenarioId: 12 }));
    expect(fakeApi.bodyOf(`POST ${LIST}random/`)).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Random scenario" }));
    await waitFor(() => expect(picked).toEqual({ name: "Wyrdstone Hunt", scenarioId: 11 }));
  });

  it("shows the server's words when nothing can be drawn", async () => {
    const user = setupUser();
    const detail = "No scenario on the campaign's list has a weight above 0.";
    fakeApi.fail(
      `POST ${LIST}random/`,
      new ApiError(detail, 400, { detail, code: "nothing_to_draw" })
    );
    renderWithQueryClient(<Harness />);

    await user.click(screen.getByRole("button", { name: "Random scenario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
  });

  it("reads a picked scenario whole before the battle starts, from View (William, 27 Nov 2026)", async () => {
    const user = setupUser();
    fakeApi.on("GET /scenarios/11/", HUNT.scenario);
    renderWithQueryClient(<Harness />);
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();

    await user.click(screen.getByRole("combobox", { name: "Scenario" }));
    await user.click(await screen.findByRole("option", { name: /Wyrdstone Hunt/ }));
    await user.click(screen.getByRole("button", { name: "View" }));

    const sheet = await screen.findByRole("dialog", { name: "Wyrdstone Hunt" });
    expect(await within(sheet).findByRole("region", { name: "Special rules" })).toBeInTheDocument();
    expect(within(sheet).getByText("Gain wealth by picking up wyrdstone.")).toBeInTheDocument();
  });

  it("offers no View for a typed name, which has nothing to read", async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);

    await user.type(screen.getByRole("combobox", { name: "Scenario" }), "Bridge fight");
    await user.click(screen.getByRole("option", { name: "Play “Bridge fight”" }));
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
  });
});
