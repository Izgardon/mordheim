import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SpecialIcon, type SpecialCategory, type SpecialKind } from "@/components/ui/game-icons";
import { Input } from "@/components/ui/input";
import { TEXTAREA } from "@/features/catalogue/components/form-layout";

import { Field } from "./editor-ui";
import type { RuleDraft } from "./rule-draft";

const KINDS: { value: SpecialKind; label: string }[] = [
  { value: "boon", label: "Boon" },
  { value: "bane", label: "Bane" },
  { value: "trait", label: "Trait" },
];

const CATEGORIES: { value: SpecialCategory; label: string }[] = [
  { value: "injury", label: "Injury" },
  { value: "mutation", label: "Mutation" },
  { value: "aura", label: "Aura" },
  { value: "body", label: "Body" },
];

const SELECT = "h-9 border border-strong bg-page px-2 text-sm text-ink";

/**
 * A new rule's name, Boons & Banes kind, category (an aura unless picked; the icon it will have
 * shows beside the name) and text: the template's own once saved.
 */
export default function NewRule({
  name,
  onAdd,
  onCancel,
}: {
  name: string;
  onAdd: (rule: RuleDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>({
    special_id: null,
    name,
    kind: "trait",
    category: "aura",
    description: "",
  });
  return (
    <div className="flex w-full flex-col gap-2 border border-line bg-page p-2.5">
      <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-[1fr_auto_auto]">
        <Field label="New rule" className="col-span-2 min-[520px]:col-span-1">
          <span className="flex items-center gap-1.5">
            <SpecialIcon category={draft.category} kind={draft.kind} />
            <Input
              inputSize="sm"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </span>
        </Field>
        <Field label="Kind">
          <select
            className={SELECT}
            value={draft.kind}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as SpecialKind })}
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            className={SELECT}
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value as SpecialCategory })
            }
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <textarea
        aria-label="Rule text"
        maxLength={4000}
        className={TEXTAREA.replace("min-h-[120px]", "min-h-[80px]")}
        value={draft.description}
        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!draft.name.trim()}
          onClick={() => onAdd(draft)}
        >
          Add rule
        </Button>
      </div>
    </div>
  );
}
