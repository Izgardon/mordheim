import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";

import { lineName, priceLabel as linePrice } from "../template-view";
import type { TemplateList, WarbandTemplate } from "../types/template-types";
import { CAPTION, Field, FORM_BOX, SaveRow } from "./editor-ui";
import AddItem from "./AddItem";
import { useItemCharts } from "./item-charts";
import { listDraft, newLine, type ListDraft } from "./list-draft";
import LineFields from "./LineFields";

type ListFormProps = {
  campaignId: number;
  template: WarbandTemplate;
  list: TemplateList | null;
  pending: boolean;
  error: string;
  onSave: (draft: ListDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
};

/**
 * One equipment list's form: its name and note, who buys from it, its lines (each opens to its
 * price, brace, first free, shown-as name, who may take it, most per warband, note and variant)
 * and Add an item with the store's search (name, tags and rules). Any item can go on the list; one
 * the template's types can't usually buy shows the chart's reason.
 */
export default function ListForm(props: ListFormProps) {
  const { template, campaignId } = props;
  const [draft, setDraft] = useState<ListDraft>(() => listDraft(template, props.list));
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const charts = useItemCharts(campaignId, template.id);
  const set = (patch: Partial<ListDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const toggleUser = (key: string) =>
    set({
      fighters: draft.fighters.includes(key)
        ? draft.fighters.filter((held) => held !== key)
        : [...draft.fighters, key],
    });

  return (
    <div
      className={FORM_BOX}
      role="group"
      aria-label={props.list ? `Edit ${props.list.name}` : "New list"}
    >
      <div className="grid grid-cols-1 gap-2 min-[620px]:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={160}
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
            />
          )}
        </Field>
        <Field label="Note">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={500}
              value={draft.note}
              onChange={(event) => set({ note: event.target.value })}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={CAPTION}>Who uses it</span>
        <div className="flex flex-wrap gap-1.5">
          {template.fighters.map((fighter) => (
            <Chip
              key={fighter.key}
              pressed={draft.fighters.includes(fighter.key)}
              onClick={() => toggleUser(fighter.key)}
            >
              {fighter.kind === "henchman" && fighter.plural ? fighter.plural : fighter.name}
            </Chip>
          ))}
        </div>
      </div>
      <ul aria-label="Lines" className="m-0 flex list-none flex-col p-0">
        {draft.lines.map((line, index) => (
          <li
            key={line.id ?? `new-${index}`}
            className="flex flex-col border-t border-line first:border-t-0"
          >
            <button
              type="button"
              onClick={() => setOpenLine(openLine === index ? null : index)}
              className="flex items-baseline justify-between gap-3 py-1.5 text-left text-sm hover:bg-raised"
            >
              <span className="text-ink">
                {lineName({ item: line.item, shown_as: line.shownAs })}
              </span>
              <span className="shrink-0 font-mono text-[13px] text-ink">
                {linePrice({
                  cost: line.cost === "" ? null : Number(line.cost),
                  cost_note: line.costNote,
                  first_free: line.firstFree,
                  brace_cost: line.brace === "" ? null : Number(line.brace),
                })}
              </span>
            </button>
            {openLine === index ? (
              <LineFields
                line={line}
                chart={charts.chartOf(line.item.id)}
                reason={charts.reasonOf(line.item.id)}
                fighters={template.fighters}
                variants={template.variants}
                onChange={(next) =>
                  set({ lines: draft.lines.map((row, at) => (at === index ? next : row)) })
                }
                onRemove={() => {
                  set({ lines: draft.lines.filter((_, at) => at !== index) });
                  setOpenLine(null);
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <AddItem
        charts={charts}
        onAdd={(item) => {
          set({ lines: [...draft.lines, newLine(item, charts.offers.get(item.id))] });
          setOpenLine(draft.lines.length);
        }}
      />
      <SaveRow
        label={props.list ? "Save list" : "Add list"}
        pending={props.pending}
        error={props.error}
        disabled={!draft.name.trim()}
        onSave={() => props.onSave(draft)}
        onCancel={props.onCancel}
      >
        {props.onDelete ? (
          <Button
            size="sm"
            variant="danger"
            disabled={props.pending}
            onClick={() => (deleting ? props.onDelete?.() : setDeleting(true))}
          >
            {deleting ? "Delete for good" : "Delete list"}
          </Button>
        ) : null}
      </SaveRow>
      {deleting ? (
        <p className="m-0 text-xs font-semibold text-danger">
          Its lines go, and its fighters no longer buy from it.
        </p>
      ) : null}
    </div>
  );
}
