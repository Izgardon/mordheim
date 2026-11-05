import { useState } from "react";
import { Plus } from "lucide-react";

import { saveUpgrades } from "../api/editor-api";
import type { UpgradeInput } from "../types/editor-types";
import type { SectionProps } from "./section-props";
import UpgradeForm from "./UpgradeForm";
import type { TemplateUpgrade } from "../types/template-types";
import { savedUpgrades, upgradeDraft, upgradeInput } from "./upgrade-draft";

type Editing = { index: number } | "add" | null;

const price = (upgrade: TemplateUpgrade) =>
  upgrade.cost === 0
    ? "free"
    : upgrade.cost !== null
      ? `${upgrade.cost} gc`
      : upgrade.cost_note || "–";

/** "Tainted Ones only · at most 1 · later double · only when recruited". */
const terms = (upgrade: TemplateUpgrade) =>
  [
    upgrade.who_text,
    upgrade.max_per_fighter ? `at most ${upgrade.max_per_fighter}` : "",
    upgrade.later_double ? "later double" : "",
    upgrade.at_recruit ? "only when recruited" : "",
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Upgrades: paid extras bought onto a hero (mutations, Marks), by group, each giving a special
 * picked from the catalogue (or written as the template's own). Each add, edit and delete saves
 * the upgrades whole.
 */
export default function UpgradesSection({ answer, campaignId, save }: SectionProps) {
  const { template } = answer;
  const upgrades = template.upgrades;
  const rows = savedUpgrades(upgrades);
  const groups = [...new Set(upgrades.map((upgrade) => upgrade.group))];
  const [editing, setEditing] = useState<Editing>(null);
  const commit = async (next: UpgradeInput[]) => {
    if (await save.run(saveUpgrades(next))) setEditing(null);
  };
  const close = () => {
    setEditing(null);
    save.clearError();
  };

  return (
    <section aria-label="Upgrades" className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group} className="flex flex-col">
          <h3 className="m-0 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            {group}
          </h3>
          {upgrades.map((upgrade, index) =>
            upgrade.group !== group ? null : editing !== null &&
              editing !== "add" &&
              editing.index === index ? (
              <UpgradeForm
                key={upgrade.id}
                campaignId={campaignId}
                template={template}
                initial={upgradeDraft(upgrade)}
                groups={groups}
                isNew={false}
                pending={save.pending}
                error={save.error}
                onCancel={close}
                onSave={(draft) => {
                  const row = upgradeInput(draft);
                  if (row) void commit(rows.map((other, at) => (at === index ? row : other)));
                }}
                onDelete={() => void commit(rows.filter((_, at) => at !== index))}
              />
            ) : (
              <button
                key={upgrade.id}
                type="button"
                disabled={editing !== null}
                onClick={() => setEditing({ index })}
                className="flex flex-col gap-0.5 border-t border-line py-2 text-left first-of-type:border-t-0 hover:bg-raised disabled:hover:bg-transparent"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-head">{upgrade.name}</span>
                  <span className="shrink-0 font-mono text-[13px] text-ink">{price(upgrade)}</span>
                </span>
                {terms(upgrade) ? (
                  <span className="text-xs text-muted-foreground">{terms(upgrade)}</span>
                ) : null}
              </button>
            )
          )}
        </div>
      ))}
      {editing === "add" ? (
        <UpgradeForm
          campaignId={campaignId}
          template={template}
          initial={upgradeDraft(null, groups[0] ?? "")}
          groups={groups}
          isNew
          pending={save.pending}
          error={save.error}
          onCancel={close}
          onSave={(draft) => {
            const row = upgradeInput(draft);
            if (row) void commit([...rows, row]);
          }}
        />
      ) : null}
      {editing === null ? (
        <button
          type="button"
          onClick={() => setEditing("add")}
          className="inline-flex min-h-9 items-center gap-1.5 self-start border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Upgrade
        </button>
      ) : null}
    </section>
  );
}
