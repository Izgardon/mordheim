import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { ModalSheet } from "@/components/ui/modal-sheet";
import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { useCatalogue } from "@/lib/catalogue-queries";
import { cn } from "@/lib/utils";

import type { GearTab } from "./UnitCard";

type GearEntry = {
  key: string;
  name: string;
  kind: string;
  rules: { name: string; text: string }[];
  /** A single-use item: its id, how many it has and how many are used. */
  single?: { itemId: number; quantity: number; used: number };
};

type GearSheetProps = {
  campaignId: number;
  /** The unit and which list, or null when closed. */
  target: { unit: PrebattleUnit; tab: GearTab } | null;
  canAct: boolean;
  usedCount: (unitKey: string, itemId: number) => number;
  busyKey: string | null;
  onOpenChange: (open: boolean) => void;
  onUse: (unit: PrebattleUnit, itemId: number) => void;
  onUndoUse: (unit: PrebattleUnit, itemId: number) => void;
};

const TITLE: Record<GearTab, string> = { gear: "gear", skills: "skills", spells: "spells" };

/** "S4", "S+1", or the words ("As user"). */
function strengthLabel(strength: string | null | undefined) {
  const value = strength?.trim();
  if (!value) return null;
  return /^[+-]?\d+$/.test(value) ? `S${value}` : value;
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

/**
 * The quick-gear sheet (design E): each item, skill or spell with its type, opening to its rules;
 * a single-use item has Use (today's item use), and once used says so with Undo.
 */
export default function GearSheet({
  campaignId,
  target,
  canAct,
  usedCount,
  busyKey,
  onOpenChange,
  onUse,
  onUndoUse,
}: GearSheetProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const items = useCatalogue("items", campaignId, { enabled: target?.tab === "gear" }).data;
  const properties = useCatalogue("item-properties", campaignId, {
    enabled: target?.tab === "gear",
  }).data;
  const skills = useCatalogue("skills", campaignId, { enabled: target?.tab === "skills" }).data;
  const specials = useCatalogue("specials", campaignId, { enabled: target?.tab === "skills" }).data;
  const spells = useCatalogue("spells", campaignId, { enabled: target?.tab === "spells" }).data;
  useEffect(() => setOpenKey(null), [target]);

  const unit = target?.unit;
  const entries: GearEntry[] = !unit
    ? []
    : target.tab === "gear"
      ? (unit.items ?? []).map((owned) => {
          const item = items.find((entry) => entry.id === owned.id);
          const single = unit.singleUseItems?.find((entry) => entry.id === owned.id);
          const stats = [item?.range, strengthLabel(item?.strength)].filter(Boolean);
          const rules = (item?.properties ?? []).map((property) => ({
            name: property.name,
            text: properties.find((entry) => entry.id === property.id)?.description ?? "",
          }));
          return {
            key: `item:${owned.id}`,
            name: owned.count > 1 ? `${owned.name} ×${owned.count}` : owned.name,
            kind: [item?.type, stats.join(" ")].filter(Boolean).join(" · ") || "Item",
            rules: item?.description
              ? [...rules, { name: "About", text: item.description }]
              : rules,
            single:
              owned.singleUse || single
                ? {
                    itemId: owned.id,
                    quantity: single?.quantity ?? owned.count,
                    used: usedCount(unit.key, owned.id),
                  }
                : undefined,
          };
        })
      : target.tab === "skills"
        ? [
            ...(unit.skills ?? []).map((owned) => {
              const skill = skills.find((entry) => entry.id === owned.id);
              return {
                key: `skill:${owned.id}`,
                name: owned.name,
                kind: skill?.type ? `Skill · ${skill.type}` : "Skill",
                rules: skill?.description ? [{ name: owned.name, text: skill.description }] : [],
              };
            }),
            ...(unit.specials ?? []).map((owned) => {
              const special = specials.find((entry) => entry.id === owned.id);
              return {
                key: `special:${owned.id}`,
                name: owned.name,
                kind: special?.type || "Special",
                rules: special?.description
                  ? [{ name: owned.name, text: special.description }]
                  : [],
              };
            }),
          ]
        : (unit.spells ?? []).map((owned) => {
            const spell = spells.find((entry) => entry.id === owned.id);
            const difficulty = owned.dc ?? spell?.dc;
            return {
              key: `spell:${owned.id}`,
              name: owned.name,
              kind:
                [spell?.type, difficulty ? String(difficulty) : null].filter(Boolean).join(" · ") ||
                "Spell",
              rules: spell?.description ? [{ name: "Effect", text: spell.description }] : [],
            };
          });

  return (
    <ModalSheet
      open={target !== null}
      onOpenChange={onOpenChange}
      kicker="Quick reference"
      title={unit ? `${firstName(unit.displayName)}’s ${TITLE[target.tab]}` : "Gear"}
    >
      {entries.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Nothing here.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {entries.map((entry) => {
          const isOpen = openKey === entry.key;
          const single = entry.single;
          const usedUp = single ? single.used >= single.quantity : false;
          const busy = unit && single ? busyKey === `${unit.key}:${single.itemId}` : false;
          return (
            <div
              key={entry.key}
              className={cn(
                "flex flex-col border bg-surface",
                isOpen ? "border-accent-line" : "border-border"
              )}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : entry.key)}
                className="flex min-h-12 items-center justify-between gap-2.5 px-3 text-left"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-ink">{entry.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.kind}
                    {single
                      ? ` · once per battle${single.used ? ` · ${single.used} of ${single.quantity} used` : ""}`
                      : ""}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
              {isOpen ? (
                <div className="flex flex-col gap-1.5 px-3 pb-2.5">
                  {entry.rules.length === 0 ? (
                    <p className="m-0 text-[13px] text-muted-foreground">No rules written down.</p>
                  ) : null}
                  {entry.rules.map((rule) => (
                    <p key={rule.name} className="m-0 whitespace-pre-line text-[13px] text-text2">
                      <span className="font-bold text-accent-hi">{rule.name}</span>
                      {rule.text ? ` · ${rule.text}` : ""}
                    </p>
                  ))}
                  {single && unit && canAct ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={usedUp || busy}
                        onClick={() => onUse(unit, single.itemId)}
                        className="min-h-10 self-start border border-strong px-3 text-xs font-bold text-ink disabled:opacity-50"
                      >
                        {usedUp ? "Used" : "Use"}
                      </button>
                      {single.used ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onUndoUse(unit, single.itemId)}
                          className="min-h-10 px-2 text-xs font-bold text-accent-text underline underline-offset-2"
                        >
                          Undo
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ModalSheet>
  );
}
