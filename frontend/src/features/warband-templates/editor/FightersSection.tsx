import { useState } from "react";
import { Plus } from "lucide-react";

import { addFighter, removeFighter, saveFighter } from "../api/editor-api";
import { countLabel, groupLabel } from "../template-view";
import type { TemplateFighter } from "../types/template-types";
import { Warnings } from "./editor-ui";
import { warningsFor } from "./editor-facts";
import { fighterInput } from "./fighter-draft";
import FighterForm from "./FighterForm";
import type { SectionProps } from "./section-props";

type Open = { key: string } | { kind: "hero" | "henchman" } | null;

/** "20 XP · Human · Leader" or "groups of 1–5 · gains XP · can be promoted". */
function facts(fighter: TemplateFighter) {
  const henchman = fighter.kind === "henchman";
  return [
    henchman ? groupLabel(fighter) : `${fighter.starting_xp} XP`,
    fighter.race ?? "",
    fighter.is_leader ? "Leader" : "",
    fighter.caster !== "No" ? fighter.caster : "",
    fighter.large ? "Large" : "",
    henchman ? (fighter.gains_xp ? "gains XP" : "gains no XP") : "",
    henchman ? (fighter.promotable ? "can be promoted" : "can't be promoted") : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

const ADD =
  "inline-flex min-h-9 items-center gap-1.5 border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised";

/**
 * Fighters: the heroes and the henchmen, each a row with his cost, how many and his facts (and
 * his warnings); a row opens his form, saved on its own. + Hero and + Henchmen add one, with a
 * key of his own that never changes.
 */
export default function FightersSection({ answer, campaignId, save }: SectionProps) {
  const { template } = answer;
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
    save.clearError();
  };
  const form = (fighter: TemplateFighter | null, kind: "hero" | "henchman") => (
    <FighterForm
      key={fighter?.key ?? `new-${kind}`}
      campaignId={campaignId}
      template={template}
      fighter={fighter}
      kind={kind}
      pending={save.pending}
      error={save.error}
      onCancel={close}
      onSave={async (draft) => {
        const body = fighterInput(draft);
        const saved = await save.run(fighter ? saveFighter(fighter.key, body) : addFighter(body));
        if (saved) close();
      }}
      onDelete={
        fighter
          ? async () => {
              if (await save.run(removeFighter(fighter.key))) close();
            }
          : undefined
      }
    />
  );
  const group = (kind: "hero" | "henchman", title: string) => {
    const fighters = template.fighters.filter((fighter) => fighter.kind === kind);
    return (
      <div className="flex flex-col">
        <h3 className="m-0 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {title}
        </h3>
        {fighters.map((fighter) =>
          open && "key" in open && open.key === fighter.key ? (
            form(fighter, kind)
          ) : (
            <button
              key={fighter.key}
              type="button"
              onClick={() => setOpen({ key: fighter.key })}
              className="flex flex-col gap-0.5 border-t border-line py-2 text-left first-of-type:border-t-0 hover:bg-raised"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-head">
                  {kind === "henchman" && fighter.plural ? fighter.plural : fighter.name}
                </span>
                <span className="shrink-0 font-mono text-[13px] text-ink">
                  {fighter.cost} gc · {countLabel(fighter)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{facts(fighter)}</span>
              <Warnings warnings={warningsFor(answer.warnings, "fighters", fighter.key)} />
            </button>
          )
        )}
        {open && "kind" in open && open.kind === kind ? form(null, kind) : null}
      </div>
    );
  };

  return (
    <section aria-label="Fighters" className="flex flex-col gap-4">
      <Warnings warnings={warningsFor(answer.warnings, "fighters", "")} />
      {group("hero", "Heroes")}
      {group("henchman", "Henchmen")}
      {open === null ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ADD} onClick={() => setOpen({ kind: "hero" })}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Hero
          </button>
          <button type="button" className={ADD} onClick={() => setOpen({ kind: "henchman" })}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Henchmen
          </button>
        </div>
      ) : null}
    </section>
  );
}
