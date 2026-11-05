import type { Item, ItemOffer } from "@/features/items/types/item-types";

import type { ListInput } from "../types/editor-types";
import type {
  TemplateLine,
  TemplateList,
  TemplateWho,
  WarbandTemplate,
} from "../types/template-types";
import { numberOrNull, textOf } from "./editor-ui";

/** A list line as its form edits it: prices as typed; `whoText` is the saved line's. */
export type LineDraft = {
  /** The saved line's id (it keeps its row); none for a line added here. */
  id?: number;
  item: { id: number; name: string; variant: string; type: string };
  shownAs: string;
  cost: string;
  costNote: string;
  firstFree: boolean;
  brace: string;
  who: TemplateWho;
  whoText: string;
  most: string;
  note: string;
  variant: string;
};

export type ListDraft = { name: string; note: string; fighters: string[]; lines: LineDraft[] };

export const lineDraft = (line: TemplateLine): LineDraft => ({
  id: line.id,
  item: line.item,
  shownAs: line.shown_as,
  cost: textOf(line.cost),
  costNote: line.cost_note,
  firstFree: line.first_free,
  brace: textOf(line.brace_cost),
  who: line.who,
  whoText: line.who_text,
  most: textOf(line.warband_max),
  note: line.note,
  variant: line.variant,
});

/** The fighters who buy from a list (by key). */
export const usersOf = (template: WarbandTemplate, key: string) =>
  template.fighters.filter((fighter) => fighter.lists.includes(key)).map((fighter) => fighter.key);

export function listDraft(template: WarbandTemplate, list: TemplateList | null): ListDraft {
  if (!list) return { name: "", note: "", fighters: [], lines: [] };
  return {
    name: list.name,
    note: list.note,
    fighters: usersOf(template, list.key),
    lines: list.lines.map(lineDraft),
  };
}

/** The chart's price row an item offers the template's types (who-can's pick), else its first. */
export const chartRow = (item: Item, offer?: ItemOffer) =>
  item.availabilities.find((row) => row.id === offer?.availability_id) ?? item.availabilities[0];

/** A new line for an item, at the chart's price to start from. */
export function newLine(item: Item, offer?: ItemOffer): LineDraft {
  const row = chartRow(item, offer);
  return {
    item: { id: item.id, name: item.name, variant: item.variant ?? "", type: item.type },
    shownAs: "",
    cost: textOf(row?.cost),
    costNote: "",
    firstFree: false,
    brace: "",
    who: {},
    whoText: "",
    most: "",
    note: "",
    variant: "",
  };
}

/** What the list's Save sends. */
export function listInput(draft: ListDraft): ListInput {
  return {
    name: draft.name.trim(),
    note: draft.note.trim(),
    fighters: draft.fighters,
    lines: draft.lines.map((line) => ({
      ...(line.id !== undefined ? { id: line.id } : {}),
      item_id: line.item.id,
      shown_as: line.shownAs.trim(),
      cost: numberOrNull(line.cost),
      cost_note: line.costNote.trim(),
      first_free: line.firstFree,
      brace_cost: numberOrNull(line.brace),
      who: line.who,
      warband_max: numberOrNull(line.most),
      note: line.note.trim(),
      variant: line.variant,
    })),
  };
}
