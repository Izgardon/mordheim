import { describe, expect, it } from "vitest";

import { makeEditorTemplate } from "@/test/template-editor-fixtures";

import { listDraft, listInput } from "./list-draft";

describe("a list's save", () => {
  it("keeps each saved line's id, an empty price as none and who buys from it", () => {
    const template = makeEditorTemplate();
    const draft = listDraft(template, template.lists[0]);
    draft.lines[0] = { ...draft.lines[0], cost: "", costNote: "3 × price" };
    const sent = listInput(draft);
    expect(sent.fighters).toEqual(["champions"]);
    expect(sent.lines[0]).toMatchObject({ id: 50, item_id: 3, cost: null, cost_note: "3 × price" });
  });
});
