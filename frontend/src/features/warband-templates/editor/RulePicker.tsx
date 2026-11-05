import { useState } from "react";

import { SpecialIcon } from "@/components/ui/game-icons";
import { SearchCombobox, SelectedChip } from "@/components/ui/search-select";
import { useCatalogue } from "@/lib/catalogue-queries";

import NewRule from "./NewRule";
import { pickedRule, ruleOptions, type RuleDraft } from "./rule-draft";

/**
 * Rules as specials: the ones held as chips, then a search of the campaign's specials (this
 * template's own first) to link one, or a name nobody has to write a new one. `single`: one rule
 * only (an upgrade's), which a pick replaces.
 */
export default function RulePicker({
  campaignId,
  templateName,
  rules,
  onChange,
  single = false,
  label,
}: {
  campaignId: number;
  templateName: string;
  rules: RuleDraft[];
  onChange: (rules: RuleDraft[]) => void;
  single?: boolean;
  label: string;
}) {
  const specials = useCatalogue("specials", campaignId);
  const [adding, setAdding] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  const held = new Set(rules.map((rule) => rule.special_id));
  const options = ruleOptions(specials.data, templateName).filter(
    (option) => !held.has(Number(option.id))
  );
  const add = (rule: RuleDraft) => {
    onChange(single ? [rule] : [...rules, rule]);
    setAdding(false);
    setWriting(null);
  };

  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {rules.map((rule, index) => (
        <SelectedChip
          key={`${rule.special_id ?? "new"}-${rule.name}`}
          option={{
            id: rule.special_id ?? rule.name,
            title: rule.name,
            subtitle: rule.special_id === null ? "New" : undefined,
            icon: <SpecialIcon category={rule.category} kind={rule.kind} />,
          }}
          onRemove={single ? undefined : () => onChange(rules.filter((_, at) => at !== index))}
        />
      ))}
      {writing !== null ? (
        <NewRule name={writing} onAdd={add} onCancel={() => setWriting(null)} />
      ) : adding ? (
        <SearchCombobox
          label={label}
          options={options}
          loading={specials.isLoading}
          autoFocus
          className="w-full min-[520px]:w-80"
          emptyText="No rule by that name."
          create={{
            label: (typed) => `Write a new rule: ${typed}`,
            onCreate: (typed) => setWriting(typed),
          }}
          onPick={(option) => {
            const picked = pickedRule(specials.data, Number(option.id));
            if (picked) add(picked);
          }}
          onDismiss={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-[38px] items-center border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
        >
          {single && rules.length ? "Change" : label}
        </button>
      )}
    </div>
  );
}
