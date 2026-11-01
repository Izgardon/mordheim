import { useState } from "react";

import { Button } from "@components/button";
import { FieldError } from "@components/field-error";
import { Input } from "@components/input";
import { Label } from "@components/label";

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

const MATCHES = 8;

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
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const picked = new Set(rules.map((rule) => rule.ruleId));
  const matches = needle
    ? shared.filter((rule) => rule.name.toLowerCase().includes(needle) && !picked.has(rule.id))
    : [];

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
      <Input
        inputSize="sm"
        type="search"
        aria-label="Add a shared rule"
        placeholder="Search shared rules"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length ? (
        <ul className="m-0 flex max-h-48 list-none flex-col overflow-y-auto border border-line p-0">
          {matches.slice(0, MATCHES).map((rule) => (
            <li key={rule.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...rules, blankRule(rule.id, rule.name)]);
                  setQuery("");
                }}
                className="flex w-full flex-col px-2 py-1.5 text-left hover:bg-raised"
              >
                <span className="text-[13px] font-semibold text-ink">{rule.name}</span>
                {rule.summary ? (
                  <span className="text-xs text-muted-foreground">{rule.summary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
