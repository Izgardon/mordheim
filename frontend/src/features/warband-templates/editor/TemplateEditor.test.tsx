/**
 * The template editor (the templates plan, phase 4) over the fake API: its header's facts and
 * change note, the warnings in their sections, a book template's first save making the
 * campaign's house version (which the editor then follows), and a section saved whole.
 */
import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { skill } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import {
  makeEditorAnswer,
  makeEditorFighter,
  makeEditorTemplate,
} from "@/test/template-editor-fixtures";
import { setupUser } from "@/test/user-event";

import TemplateEditor from "./TemplateEditor";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const EDITOR = `GET /warband-templates/1/editor/?campaign_id=${CAMPAIGN_ID}`;
const moves: number[] = [];

function Harness() {
  const [templateId, setTemplateId] = useState<number | null>(1);
  return (
    <TemplateEditor
      campaignId={CAMPAIGN_ID}
      templateId={templateId}
      onTemplateChange={(next) => {
        moves.push(next);
        setTemplateId(next);
      }}
      onClose={() => setTemplateId(null)}
    />
  );
}

const panel = () => screen.getByRole("dialog");

beforeEach(() => {
  fakeApi.reset();
  moves.length = 0;
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(
    EDITOR,
    makeEditorAnswer({
      warnings: [
        { section: "fighters", key: "", text: "No fighter is the leader." },
        { section: "fighters", key: "champions", text: "No list and no fixed kit." },
      ],
    })
  );
});

describe("The template editor", () => {
  it("says where the template comes from, how many warbands use it and what a save reaches", async () => {
    renderWithQueryClient(<Harness />);
    expect(await screen.findByText("The book's · used by 2 warbands")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Saving makes this campaign's house version. Changes reach the next recruits and list prices, never units already on a roster."
      )
    ).toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: /^Fighters/ })).toBeInTheDocument();
  });

  it("shows a fighter's warnings on his row", async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^Fighters/ }));
    expect(screen.getByText("No fighter is the leader.")).toBeInTheDocument();
    const row = screen.getByRole("button", { name: /^Champion/ });
    expect(row).toHaveTextContent("35 gc · 0–2");
    expect(row).toHaveTextContent("No list and no fixed kit.");
  });

  it("follows the house version a book template's first save makes", async () => {
    const version = makeEditorTemplate({ id: 2, campaign_id: CAMPAIGN_ID, replaces: 1 });
    fakeApi.on("PUT /warband-templates/1/fighters/champions/", () =>
      makeEditorAnswer({
        template: { ...version, fighters: [{ ...version.fighters[0], cost: 40 }] },
        facts: { source: "house", copied_from: null, warbands: 2 },
      })
    );
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^Fighters/ }));
    await user.click(screen.getByRole("button", { name: /^Champion/ }));
    const cost = screen.getByLabelText("Cost");
    await user.clear(cost);
    await user.type(cost, "40");
    await user.click(screen.getByRole("button", { name: "Save fighter" }));

    expect(
      await screen.findByText("The book's, house version · used by 2 warbands")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert to book" })).toBeInTheDocument();
    expect(moves).toEqual([2]);
    expect(fakeApi.bodyOf("PUT /warband-templates/1/fighters/champions/")).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      cost: 40,
      lists: ["kit"],
      rules: [{ special_id: 40 }],
    });
  });

  it("picks the skills a fighter starts with and saves them in order", async () => {
    // William, 7 Nov 2026: a fighter starts with a skill as one he'd learned ("yes please do that")
    const hunter = { id: 5, name: "Hunter", description: "Fires each turn." };
    fakeApi.on(`GET /skills/?campaign_id=${CAMPAIGN_ID}`, [
      skill({ id: 5, name: "Hunter" }),
      skill({ id: 3, name: "Leap" }),
    ]);
    fakeApi.on(
      EDITOR,
      makeEditorAnswer({
        template: makeEditorTemplate({ fighters: [makeEditorFighter({ skills: [hunter] })] }),
      })
    );
    fakeApi.on("PUT /warband-templates/1/fighters/champions/", () => makeEditorAnswer());
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^Fighters/ }));
    await user.click(screen.getByRole("button", { name: /^Champion/ }));
    expect(screen.getByRole("button", { name: "Remove Hunter" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skill" }));
    await user.type(screen.getByRole("combobox", { name: "Skill" }), "Leap{Enter}");
    await user.click(screen.getByRole("button", { name: "Save fighter" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("PUT /warband-templates/1/fighters/champions/")).toMatchObject({
        skill_ids: [5, 3],
      })
    );
  });

  it("saves the rules whole when one is added, for one variant", async () => {
    fakeApi.on("PUT /warband-templates/1/rules/", () => makeEditorAnswer());
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: "Rules" }));
    expect(screen.getByRole("article", { name: "S4 heroes" })).toHaveTextContent("Middenheim only");
    await user.click(screen.getByRole("button", { name: "Add rule" }));
    const form = screen.getByRole("form", { name: "Add a rule" });
    await user.type(within(form).getByLabelText("Title"), "Lantern Bearer");
    await user.selectOptions(within(form).getByLabelText("Variant"), "reikland");
    await user.click(within(form).getByRole("button", { name: "Add rule" }));

    expect(fakeApi.bodyOf("PUT /warband-templates/1/rules/")).toEqual({
      campaign_id: CAMPAIGN_ID,
      rules: [
        {
          id: 1,
          title: "Hard Bargains",
          description: "Haggle.",
          variant: "",
          warband_type_id: null,
        },
        {
          id: 2,
          title: "S4 heroes",
          description: "",
          variant: "middenheim",
          warband_type_id: null,
        },
        { title: "Lantern Bearer", description: "", variant: "reikland", warband_type_id: null },
      ],
    });
  });

  it("offers only heroes as an upgrade's named fighters: upgrades are bought for heroes", async () => {
    const brethren = makeEditorFighter({
      id: 8,
      key: "brethren",
      kind: "henchman",
      name: "Brother",
    });
    fakeApi.on(
      EDITOR,
      makeEditorAnswer({
        template: makeEditorTemplate({
          fighters: [makeEditorFighter(), { ...brethren, plural: "Brethren" }],
        }),
      })
    );
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^Upgrades/ }));
    await user.click(screen.getByRole("button", { name: "Upgrade" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Who may take it" }), "named");
    const form = screen.getByRole("group", { name: "New upgrade" });
    expect(within(form).getByRole("button", { name: "Champion" })).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Brethren" })).toBeNull();
  });

  it("ties each field's label to its input (for=, not only wrapped)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^Fighters/ }));
    await user.click(screen.getByRole("button", { name: /^Champion/ }));
    for (const name of ["Name", "Plural", "Fixed kit"]) {
      const input = screen.getByRole("textbox", { name });
      expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent(name);
    }
  });

  it("names each variant's bonus the Rare search bonus (William, 7 Nov 2026)", async () => {
    renderWithQueryClient(<Harness />);
    const basics = await screen.findByRole("region", { name: "Basics" });
    expect(within(basics).getAllByRole("textbox", { name: "Rare search bonus" })).toHaveLength(2);
    expect(within(basics).queryByRole("textbox", { name: "Rare" })).toBeNull();
  });

  it('asks "Discard changes?" before it closes with a section changed and not saved', async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await screen.findAllByRole("textbox", { name: "Name" });
    await user.click(within(panel()).getByRole("button", { name: "Close panel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); // nothing changed
  });

  it("keeps editing, or discards, a change made before closing", async () => {
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    const [name] = await screen.findAllByRole("textbox", { name: "Name" });
    await user.type(name, " of Marienburg");
    await user.click(within(panel()).getByRole("button", { name: "Close panel" }));
    const ask = await screen.findByRole("dialog", { name: "Discard changes?" });
    await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(name).toHaveValue("Mercenaries of Marienburg");
    await user.click(within(panel()).getByRole("button", { name: "Close panel" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Discard changes?" })).getByRole("button", {
        name: "Discard",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says what Revert loses before it goes back to the book", async () => {
    fakeApi.on(
      EDITOR,
      makeEditorAnswer({
        template: makeEditorTemplate({ campaign_id: CAMPAIGN_ID, replaces: 9 }),
        facts: { source: "house", copied_from: null, warbands: 1 },
      })
    );
    fakeApi.on("POST /warband-templates/1/revert/", { id: 9 });
    fakeApi.on(`GET /warband-templates/9/editor/?campaign_id=${CAMPAIGN_ID}`, makeEditorAnswer());
    const user = setupUser();
    renderWithQueryClient(<Harness />);
    await user.click(await screen.findByRole("button", { name: "Revert to book" }));
    expect(
      screen.getByText(
        "Mercenaries goes back to the book's in this campaign: every change made here goes. Units already on rosters keep what they have."
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(await screen.findByText("The book's · used by 2 warbands")).toBeInTheDocument();
    expect(moves).toEqual([9]);
  });
});
