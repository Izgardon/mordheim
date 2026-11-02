import { Button } from "@components/button";
import { FieldError } from "@components/field-error";
import { Label } from "@components/label";
import { SearchCombobox } from "@/components/ui/search-select";

import type { ItemRule } from "../types/item-types";
import { blankRule, type RuleDraft } from "../utils/item-form-values";
import RuleDraftEditor from "./RuleDraftEditor";

type RulesFieldProps = {
  rules: RuleDraft[];
  shared: ItemRule[];
  onChange: (rules: RuleDraft[]) => void;
  errorOf: (path: string) => string | undefined;
  idPrefix: string;
};

/**
 * A house item's rules, in order: shared rules picked from the campaign's list (the book's and its
 * own: Parry, Concussion), or rules of its own, each with an optional D6 table.
 */
export default function RulesField({
  rules,
  shared,
  onChange,
  errorOf,
  idPrefix,
}: RulesFieldProps) {
  const picked = new Set(rules.map((rule) => rule.ruleId));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Rules</Label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...rules, blankRule()])}
        >
          Add a rule of its own
        </Button>
      </div>
      <FieldError message={errorOf("rules")} />
      {rules.map((rule, index) => (
        <RuleDraftEditor
          key={rule.key}
          rule={rule}
          index={index}
          idPrefix={idPrefix}
          error={errorOf(`rules.${index}.name`)}
          onChange={(next) => onChange(rules.map((entry, at) => (at === index ? next : entry)))}
          onRemove={() => onChange(rules.filter((_, at) => at !== index))}
        />
      ))}
      <SearchCombobox
        label="Add a shared rule"
        placeholder="Search shared rules"
        emptyText="No shared rule matches."
        options={shared
          .filter((rule) => !picked.has(rule.id))
          .map((rule) => ({ id: rule.id, title: rule.name, subtitle: rule.summary || undefined }))}
        onPick={(option) => onChange([...rules, blankRule(Number(option.id), option.title)])}
      />
    </div>
  );
}
