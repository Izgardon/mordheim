import { Plus, X } from "lucide-react";

import { Button } from "@components/button";
import { FieldError } from "@components/field-error";
import { Input } from "@components/input";
import { TEXTAREA } from "@/features/catalogue/components/form-layout";

import type { RuleDraft } from "../utils/item-form-values";

type RuleDraftEditorProps = {
  rule: RuleDraft;
  index: number;
  idPrefix: string;
  error?: string;
  onChange: (rule: RuleDraft) => void;
  onRemove: () => void;
};

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * One of a house item's rules: a shared rule (its name fixed, the item's own wording optional) or
 * one of its own (a name and its text), either with an optional D6 table of rolls and results.
 */
export default function RuleDraftEditor({
  rule,
  index,
  idPrefix,
  error,
  onChange,
  onRemove,
}: RuleDraftEditorProps) {
  const id = (field: string) => `${idPrefix}-${field}-${index}`;
  const setRow = (at: number, patch: Partial<RuleDraft["d6"][number]>) =>
    onChange({ ...rule, d6: rule.d6.map((row, i) => (i === at ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-2.5 border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-baseline gap-2 text-sm font-semibold text-ink">
          {rule.ruleId ? rule.name : rule.name.trim() || "A rule of its own"}
          <span className="border border-line px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {rule.ruleId ? "shared rule" : "this item"}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove the rule ${rule.name || index + 1}`}
          className="text-muted-foreground hover:text-head"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {rule.ruleId ? null : (
        <label className={LABEL} htmlFor={id("name")}>
          Name
          <Input
            id={id("name")}
            inputSize="sm"
            value={rule.name}
            aria-invalid={Boolean(error)}
            placeholder="Rule name"
            onChange={(event) => onChange({ ...rule, name: event.target.value })}
          />
          <FieldError message={error} />
        </label>
      )}
      <label className={LABEL} htmlFor={id("text")}>
        {rule.ruleId ? "This item's own wording (optional)" : "Text"}
        <textarea
          id={id("text")}
          className={TEXTAREA.replace("min-h-[120px]", "min-h-[72px]")}
          value={rule.text}
          placeholder={rule.ruleId ? "Leave blank to use the shared rule's text." : undefined}
          onChange={(event) => onChange({ ...rule, text: event.target.value })}
        />
      </label>
      {rule.d6.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">D6 table</span>
          {rule.d6.map((row, at) => (
            <div key={at} className="flex items-center gap-2">
              <Input
                inputSize="sm"
                aria-label={`Roll ${at + 1}`}
                className="w-20 font-mono"
                placeholder="1-2"
                value={row.roll}
                onChange={(event) => setRow(at, { roll: event.target.value })}
              />
              <Input
                inputSize="sm"
                aria-label={`Result ${at + 1}`}
                placeholder="Result"
                value={row.result}
                onChange={(event) => setRow(at, { result: event.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove row ${at + 1}`}
                onClick={() => onChange({ ...rule, d6: rule.d6.filter((_, i) => i !== at) })}
                className="text-muted-foreground hover:text-head"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange({ ...rule, d6: [...rule.d6, { roll: "", result: "" }] })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {rule.d6.length ? "Add a row" : "Add a D6 table"}
        </Button>
        {rule.kept.length ? (
          <span className="text-xs text-muted-foreground">
            Keeps its {rule.kept.length === 1 ? "other table" : `${rule.kept.length} other tables`}.
          </span>
        ) : null}
      </div>
    </div>
  );
}
