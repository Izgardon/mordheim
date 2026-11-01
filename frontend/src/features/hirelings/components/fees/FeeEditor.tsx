import { Plus, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";

import { FEE_KINDS, type FeeKind } from "../../fees";
import type { FeeDraft } from "./fee-draft";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";
const RESOURCES = ["Wyrdstone", "Treasure", "Campaign points"];

/**
 * A hire fee or an upkeep as the catalogue form (and a hand-typed hire) edits it: what kind it is,
 * then for a fee its gold, dice ("70 + 3D6") and resource lines ("1 Wyrdstone"), and a note for
 * the rest ("15 gc*", another way to pay).
 */
export default function FeeEditor({
  label,
  idPrefix,
  value,
  onChange,
}: {
  label: string;
  idPrefix: string;
  value: FeeDraft;
  onChange: (next: FeeDraft) => void;
}) {
  const set = (change: Partial<FeeDraft>) => onChange({ ...value, ...change });
  const setLine = (index: number, change: Partial<FeeDraft["resources"][number]>) =>
    set({
      resources: value.resources.map((line, i) => (i === index ? { ...line, ...change } : line)),
    });
  const input = (
    key: "gold" | "dice" | "dice_multiplier",
    caption: string,
    placeholder?: string
  ) => (
    <label className={LABEL}>
      {caption}
      <Input
        id={`${idPrefix}-${key}`}
        inputSize="sm"
        inputMode="numeric"
        className="w-24 font-mono"
        placeholder={placeholder}
        value={value[key]}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </label>
  );

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL}>
          Kind
          <select
            id={`${idPrefix}-kind`}
            value={value.kind}
            onChange={(event) => set({ kind: event.target.value as FeeKind })}
            className="h-9 border border-strong bg-page px-2 text-sm text-ink"
          >
            {FEE_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        {value.kind === "gold" ? (
          <>
            {input("gold", "Gold")}
            {input("dice", "+ D6")}
            {value.dice ? input("dice_multiplier", "× each", "1") : null}
          </>
        ) : null}
      </div>
      {value.kind === "gold" ? (
        <div className="flex flex-col gap-1.5">
          {value.resources.map((line, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                aria-label="Amount"
                inputSize="sm"
                inputMode="numeric"
                className="w-16 font-mono"
                value={line.amount}
                onChange={(event) => setLine(index, { amount: event.target.value })}
              />
              <Input
                aria-label="Resource"
                inputSize="sm"
                list={`${idPrefix}-resources`}
                className="w-48"
                value={line.resource}
                onChange={(event) => setLine(index, { resource: event.target.value })}
              />
              <IconButton
                aria-label={`Remove ${line.resource || "resource"}`}
                className="h-8 w-8"
                onClick={() => set({ resources: value.resources.filter((_, i) => i !== index) })}
              >
                <X aria-hidden="true" />
              </IconButton>
            </div>
          ))}
          <datalist id={`${idPrefix}-resources`}>
            {RESOURCES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <button
            type="button"
            className="flex items-center gap-1 self-start text-[13px] font-bold text-accent-text"
            onClick={() => set({ resources: [...value.resources, { resource: "", amount: "1" }] })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add a resource
          </button>
        </div>
      ) : null}
      <label className={LABEL}>
        Note
        <Input
          id={`${idPrefix}-note`}
          inputSize="sm"
          maxLength={500}
          value={value.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </label>
    </fieldset>
  );
}
