import { useState } from "react";
import { Plus } from "lucide-react";

import { addList, removeList, saveList } from "../api/editor-api";
import type { TemplateList, WarbandTemplate } from "../types/template-types";
import { Warnings } from "./editor-ui";
import { warningsFor } from "./editor-facts";
import { listInput, usersOf } from "./list-draft";
import ListForm from "./ListForm";
import type { SectionProps } from "./section-props";

type Open = { key: string } | "new" | null;

/** "12 items · Captain, Sergeants": its size and who buys from it. */
function summary(template: WarbandTemplate, list: TemplateList) {
  const users = usersOf(template, list.key).map((key) => {
    const fighter = template.fighters.find((row) => row.key === key);
    return fighter?.kind === "henchman" && fighter.plural ? fighter.plural : (fighter?.name ?? key);
  });
  return [`${list.lines.length} item${list.lines.length === 1 ? "" : "s"}`, users.join(", ")]
    .filter(Boolean)
    .join(" · ");
}

/** Lists: each equipment list with its size and who uses it; a row opens its form, saved on its own. */
export default function ListsSection({ answer, campaignId, save }: SectionProps) {
  const { template } = answer;
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
    save.clearError();
  };
  const form = (list: TemplateList | null) => (
    <ListForm
      key={list?.key ?? "new"}
      campaignId={campaignId}
      template={template}
      list={list}
      pending={save.pending}
      error={save.error}
      onCancel={close}
      onSave={async (draft) => {
        const body = listInput(draft);
        if (await save.run(list ? saveList(list.key, body) : addList(body))) close();
      }}
      onDelete={
        list
          ? async () => {
              if (await save.run(removeList(list.key))) close();
            }
          : undefined
      }
    />
  );

  return (
    <section aria-label="Lists" className="flex flex-col gap-3">
      <div className="flex flex-col">
        {template.lists.map((list) =>
          open !== "new" && open?.key === list.key ? (
            form(list)
          ) : (
            <button
              key={list.key}
              type="button"
              onClick={() => setOpen({ key: list.key })}
              className="flex flex-col gap-0.5 border-t border-line py-2 text-left first-of-type:border-t-0 hover:bg-raised"
            >
              <span className="text-sm font-bold text-head">{list.name}</span>
              <span className="text-xs text-muted-foreground">{summary(template, list)}</span>
              <Warnings warnings={warningsFor(answer.warnings, "lists", list.key)} />
            </button>
          )
        )}
      </div>
      {open === "new" ? form(null) : null}
      {open === null ? (
        <button
          type="button"
          onClick={() => setOpen("new")}
          className="inline-flex min-h-9 items-center gap-1.5 self-start border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          List
        </button>
      ) : null}
    </section>
  );
}
