import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Circle, Minus, Plus, type LucideIcon } from "lucide-react";

import {
  SPECIAL_KIND_COLOURS,
  SpecialIcon,
  type SpecialCategory,
  type SpecialKind,
} from "@/components/ui/game-icons";
import { NumberInput } from "@/components/ui/number-input";
import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";
import {
  CatalogueDescriptionField,
  CatalogueField,
  CatalogueNameField,
} from "@/features/catalogue/components/form-layout";
import PrebattleRollFields from "@/features/catalogue/components/PrebattleRollFields";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";
import { cn } from "@/lib/utils";

import { useSpecialForm } from "../hooks/useSpecialForm";
import type { Special } from "../types/special-types";

// each with its sign in its colour (William, 22 Nov 2026: "an indicator if it is pos neg or
// neutral in the option")
const KINDS: [SpecialKind, string, LucideIcon][] = [
  ["boon", "Boon", Plus],
  ["bane", "Bane", Minus],
  ["trait", "Trait", Circle],
];

const CATEGORIES: [SpecialCategory, string][] = [
  ["injury", "Injury"],
  ["mutation", "Mutation"],
  ["aura", "Aura"],
  ["body", "Body"],
];

/** Boons & Banes' Add new, and its Edit (Revert, Delete): a boon, bane or trait. */
export default function SpecialFormDialog({
  campaignId,
  special = null,
  canDelete = false,
  onSaved,
  onDeleted,
  trigger,
}: {
  campaignId: number;
  /** The special being edited; none when adding one. */
  special?: Special | null;
  canDelete?: boolean;
  onSaved: (special: Special) => void;
  onDeleted?: (specialId: number) => void;
  trigger: ReactNode;
}) {
  const dialog = useControllableOpen({});
  const form = useSpecialForm({
    campaignId,
    special,
    resetKey: dialog.open,
    onSaved,
    onDeleted,
  });
  const { load } = form;
  const { values, set } = form;

  useEffect(() => {
    if (dialog.open) load(special);
  }, [dialog.open, load, special]);

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      editing={special}
      title={special ? "Edit boon or bane" : "Add a boon or bane"}
      noun="boon or bane"
      trigger={trigger}
      defaultTrigger={<Button>{special ? "Edit" : "Add new"}</Button>}
      submitLabel={special ? "Save changes" : "Add"}
      canDelete={canDelete}
      onReset={() => load(special)}
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
      <CatalogueField layout="dialog" label="Kind">
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
          {KINDS.map(([kind, label, Sign]) => (
            <Chip key={kind} pressed={values.kind === kind} onClick={() => set({ kind })}>
              <Sign
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  kind === "trait" && "h-2.5 w-2.5",
                  SPECIAL_KIND_COLOURS[kind]
                )}
                strokeWidth={kind === "trait" ? 3 : 2.5}
              />
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
