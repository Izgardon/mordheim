import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SpecialIcon, type SpecialCategory, type SpecialKind } from "@/components/ui/game-icons";
import { NumberInput } from "@/components/ui/number-input";
import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";
import { CatalogueTypeField } from "@/features/catalogue/components/CatalogueTypeField";
import {
  CatalogueDescriptionField,
  CatalogueField,
  CatalogueNameField,
} from "@/features/catalogue/components/form-layout";
import PrebattleRollFields from "@/features/catalogue/components/PrebattleRollFields";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useSpecialForm } from "../hooks/useSpecialForm";
import type { Special } from "../types/special-types";

const KINDS: [SpecialKind, string][] = [
  ["boon", "Boon"],
  ["bane", "Bane"],
  ["trait", "Trait"],
];

const CATEGORIES: [SpecialCategory, string][] = [
  ["injury", "Injury"],
  ["mutation", "Mutation"],
  ["aura", "Aura"],
  ["body", "Body"],
];

const TYPE_COPY = {
  label: "Type",
  placeholder: "Search or add a type",
  actionLabel: "Add type",
  actionAriaLabel: "Add custom type",
};

/** Boons & Banes' Add new: a campaign's own boon, bane or trait. */
export default function SpecialFormDialog({
  campaignId,
  typeOptions,
  onSaved,
  trigger,
}: {
  campaignId: number;
  /** The types the catalogue's specials already use. */
  typeOptions: readonly string[];
  onSaved: (special: Special) => void;
  trigger: ReactNode;
}) {
  const dialog = useControllableOpen({});
  const form = useSpecialForm({ campaignId, typeOptions, resetKey: dialog.open, onSaved });
  const { load } = form;
  const { values, set } = form;

  useEffect(() => {
    if (dialog.open) load();
  }, [dialog.open, load]);

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      title="Add a boon or bane"
      noun="boon or bane"
      trigger={trigger}
      defaultTrigger={<Button>Add new</Button>}
      submitLabel="Add"
      onReset={load}
    >
      <CatalogueNameField
        layout="dialog"
        id="special-name"
        value={values.name}
        onChange={(name) => set({ name })}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="Name"
        required
      />
      <CatalogueTypeField
        layout="dialog"
        id="special-type"
        copy={TYPE_COPY}
        field={form.typeField}
      />
      <CatalogueField layout="dialog" label="Kind">
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
          {KINDS.map(([kind, label]) => (
            <Chip key={kind} pressed={values.kind === kind} onClick={() => set({ kind })}>
              {label}
            </Chip>
          ))}
        </div>
      </CatalogueField>
      <CatalogueField layout="dialog" label="Category">
        <div role="group" aria-label="Category" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(([category, label]) => (
            <Chip
              key={category}
              pressed={values.category === category}
              onClick={() => set({ category })}
            >
              <SpecialIcon category={category} kind={values.kind} />
              {label}
            </Chip>
          ))}
        </div>
      </CatalogueField>
      <CatalogueField layout="dialog" label="Price (gc)" htmlFor="special-cost">
        <NumberInput
          id="special-cost"
          min={0}
          className="max-w-[160px]"
          value={values.cost}
          onChange={(event) => set({ cost: event.target.value })}
        />
      </CatalogueField>
      <CatalogueDescriptionField
        layout="dialog"
        id="special-description"
        value={values.description}
        onChange={(description) => set({ description })}
      />
      <PrebattleRollFields
        layout="dialog"
        idPrefix="special"
        values={values}
        onChange={(roll) => set(roll)}
      />
    </CatalogueFormDialog>
  );
}
