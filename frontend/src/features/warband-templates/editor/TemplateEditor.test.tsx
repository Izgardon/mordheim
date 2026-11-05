/**
 * The template editor (the templates plan, phase 4) over the fake API: its header's facts and
 * change note, the warnings in their sections, a book template's first save making the
 * campaign's house version (which the editor then follows), and a section saved whole.
 */
import { useState } from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeEditorAnswer, makeEditorTemplate } from "@/test/template-editor-fixtures";
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
