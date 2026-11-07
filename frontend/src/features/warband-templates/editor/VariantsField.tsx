import { Plus, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";

import type { WarbandTemplate } from "../types/template-types";
import { lossNote, variantLoss, type VariantDraft } from "./basics-draft";
import { CAPTION, Field, NumberField } from "./editor-ui";

const BLANK: VariantDraft = {
  key: "",
  name: "",
  gold: "",
  size: "",
  bonus: "",
  rest: {},
  isNew: true,
};

/**
 * The variants and their own terms (starting gold, warband size, the rare search bonus: William,
 * 7 Nov 2026, "yeah rename it"):
 * a saved variant's key stays as it is, since rules, list lines and warbands name it; one taken
 * out says what goes with it.
 */
export default function VariantsField({
  template,
  variants,
  onChange,
}: {
  template: WarbandTemplate;
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
}) {
  const set = (index: number, patch: Partial<VariantDraft>) =>
    onChange(variants.map((variant, at) => (at === index ? { ...variant, ...patch } : variant)));
  const kept = new Set(variants.map((variant) => variant.key));
  const dropped = template.variants.filter((variant) => !kept.has(variant.key));
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className={`${CAPTION} pb-1`}>Variants</legend>
      {variants.map((variant, index) => (
        <div
          key={variant.isNew ? `new-${index}` : variant.key}
          className="grid grid-cols-2 items-end gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0 min-[620px]:grid-cols-[1fr_1fr_80px_104px_70px_auto]"
        >
          <Field label="Name">
            <Input
              inputSize="sm"
              value={variant.name}
              onChange={(event) => set(index, { name: event.target.value })}
            />
          </Field>
          <Field label="Key">
            {variant.isNew ? (
              <Input
                inputSize="sm"
                value={variant.key}
                placeholder="from its name"
                onChange={(event) => set(index, { key: event.target.value })}
              />
            ) : (
              <span className="flex h-9 items-center font-mono text-[13px] text-text2">
                {variant.key}
              </span>
            )}
          </Field>
          <NumberField
            label="Gold"
            value={variant.gold}
            placeholder="—"
            onChange={(gold) => set(index, { gold })}
          />
          <NumberField
            label="Warband size"
            value={variant.size}
            placeholder="—"
            onChange={(size) => set(index, { size })}
          />
          <NumberField
            label="Rare search bonus"
            value={variant.bonus}
            placeholder="0"
            onChange={(bonus) => set(index, { bonus })}
          />
          <IconButton
            aria-label={`Take out ${variant.name || "the variant"}`}
            look="plain"
            onClick={() => onChange(variants.filter((_, at) => at !== index))}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      {dropped.map((variant) => {
        const note = lossNote(variantLoss(template, variant.key));
        return note ? (
          <p key={variant.key} className="m-0 text-xs font-semibold text-danger">
            {variant.name}: {note}
          </p>
        ) : null;
      })}
      <button
        type="button"
        onClick={() => onChange([...variants, { ...BLANK }])}
        className="inline-flex min-h-9 items-center gap-1.5 self-start border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Variant
      </button>
    </fieldset>
  );
}
