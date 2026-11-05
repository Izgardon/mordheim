import { useState } from "react";

import { useDirtySince, useReportDirty } from "@/components/ui/discard-changes";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useSettingsList } from "@/features/campaigns/api/settings-queries";
import WarbandTypePicker from "@/features/warbands/components/type-picker/WarbandTypePicker";

import { saveBasics } from "../api/editor-api";
import { basicsDraft, basicsInput, type BasicsDraft, type TypeDraft } from "./basics-draft";
import { CAPTION, Field, NumberField, SaveRow, Warnings } from "./editor-ui";
import { warningsFor } from "./editor-facts";
import type { SectionProps } from "./section-props";
import VariantsField from "./VariantsField";

const SELECT =
  "h-9 min-w-0 border border-strong bg-page px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The warband types it serves, each with the variant it always is (or picked when raising). */
function TypesField({
  campaignId,
  types,
  variants,
  onChange,
}: {
  campaignId: number;
  types: TypeDraft[];
  variants: { key: string; name: string }[];
  onChange: (types: TypeDraft[]) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={CAPTION}>Warband types</span>
      {types.map((type) => (
        <div key={type.id} className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{type.name}</span>
          {variants.length ? (
            <select
              aria-label={`${type.name}'s variant`}
              className={SELECT}
              value={type.variant}
              onChange={(event) =>
                onChange(
                  types.map((row) =>
                    row.id === type.id ? { ...row, variant: event.target.value } : row
                  )
                )
              }
            >
              <option value="">Picked when raising</option>
              {variants.map((variant) => (
                <option key={variant.key} value={variant.key}>
                  {variant.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            aria-label={`Take out ${type.name}`}
            onClick={() => onChange(types.filter((row) => row.id !== type.id))}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <WarbandTypePicker
        campaignId={campaignId}
        id="template-add-type"
        value={null}
        hidden={types.map((type) => type.id)}
        placeholder="Add a warband type"
        onPick={(type) => onChange([...types, { id: type.id, name: type.name, variant: "" }])}
      />
    </div>
  );
}

/**
 * Basics: the name, the warband types it serves (a new type of the campaign's own can be added
 * from the picker), the setting, the book's starting gold (a warband gets the campaign's plus the
 * difference from 500), the most warriors and the variants with their own terms.
 */
export default function BasicsSection({ answer, campaignId, save }: SectionProps) {
  const { template } = answer;
  const [draft, setDraft] = useState<BasicsDraft>(() => basicsDraft(template));
  const changes = useDirtySince(draft);
  useReportDirty(changes.dirty);
  const settings = useSettingsList().data?.settings ?? [];
  const set = (patch: Partial<BasicsDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const variants = draft.variants.filter((variant) => !variant.isNew && variant.name.trim());

  return (
    <section aria-label="Basics" className="flex flex-col gap-4">
      <Warnings warnings={warningsFor(answer.warnings, "basics")} />
      <Field label="Name">
        {(id) => (
          <Input
            id={id}
            value={draft.name}
            maxLength={160}
            onChange={(event) => set({ name: event.target.value })}
          />
        )}
      </Field>
      <TypesField
        campaignId={campaignId}
        types={draft.types}
        variants={variants}
        onChange={(types) => set({ types })}
      />
      <div className="grid grid-cols-2 gap-3 min-[620px]:grid-cols-[2fr_1fr_1fr]">
        <Field label="Setting" className="col-span-2 min-[620px]:col-span-1">
          {(id) => (
            <select
              id={id}
              className={SELECT}
              value={draft.settingId ?? ""}
              onChange={(event) =>
                set({ settingId: event.target.value ? Number(event.target.value) : null })
              }
            >
              <option value="">None (always in play)</option>
              {settings.map((setting) => (
                <option key={setting.id} value={setting.id}>
                  {setting.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <NumberField
          label="Starting gold"
          value={draft.gold}
          placeholder="500"
          onChange={(gold) => set({ gold })}
        />
        <NumberField
          label="Most warriors"
          value={draft.size}
          placeholder="15"
          onChange={(size) => set({ size })}
        />
      </div>
      <VariantsField
        template={template}
        variants={draft.variants}
        onChange={(next) => set({ variants: next })}
      />
      <SaveRow
        label="Save basics"
        pending={save.pending}
        error={save.error}
        disabled={!draft.name.trim()}
        onSave={async () => {
          if (await save.run(saveBasics(basicsInput(draft)))) changes.markClean();
        }}
      />
    </section>
  );
}
