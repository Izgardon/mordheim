import { useState } from "react";
import { Pencil } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import RuleForm from "@/features/warbands/components/rules/RuleForm";

import { saveRules } from "../api/editor-api";
import type { RuleRowInput } from "../types/editor-types";
import type { TemplateRule, WarbandTemplate } from "../types/template-types";
import { Field, Warnings } from "./editor-ui";
import { warningsFor } from "./editor-facts";
import type { SectionProps } from "./section-props";

type Editing = { index: number } | "add" | null;

const SELECT = "h-9 border border-strong bg-page px-2 text-sm text-ink";

const asRow = (rule: TemplateRule): RuleRowInput => ({
  id: rule.id,
  title: rule.title,
  description: rule.description,
  variant: rule.variant,
  warband_type_id: rule.warband_type_id,
});

/** "Reikland only · Ostermarkers only": whom a rule is for, when not everyone. */
function scopeOf(
  template: WarbandTemplate,
  rule: Pick<TemplateRule, "variant" | "warband_type_id">
) {
  const variant =
    template.variants.find((entry) => entry.key === rule.variant)?.name ?? rule.variant;
  const type = template.types.find((entry) => entry.id === rule.warband_type_id)?.name;
  return [variant ? `${variant} only` : "", type ? `${type} only` : ""].filter(Boolean).join(" · ");
}

/** The variant and the warband type a template's rule is for (every one when blank). */
function ScopeFields({
  template,
  scope,
  onChange,
}: {
  template: WarbandTemplate;
  scope: Pick<RuleRowInput, "variant" | "warband_type_id">;
  onChange: (scope: Pick<RuleRowInput, "variant" | "warband_type_id">) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {template.variants.length ? (
        <Field label="Variant">
          {(id) => (
            <select
              id={id}
              className={SELECT}
              value={scope.variant}
              onChange={(event) => onChange({ ...scope, variant: event.target.value })}
            >
              <option value="">Every variant</option>
              {template.variants.map((variant) => (
                <option key={variant.key} value={variant.key}>
                  {variant.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}
      {template.types.length > 1 ? (
        <Field label="Warband type">
          {(id) => (
            <select
              id={id}
              className={SELECT}
              value={scope.warband_type_id ?? ""}
              onChange={(event) =>
                onChange({
                  ...scope,
                  warband_type_id: event.target.value ? Number(event.target.value) : null,
                })
              }
            >
              <option value="">Every type</option>
              {template.types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}
    </div>
  );
}

/**
 * Rules: the template's warband rules as title and description entries, with the warband rules
 * modal's form, each for every variant or one and every type or one. Each add, edit and delete
 * saves the rules whole.
 */
export default function RulesSection({ answer, save }: SectionProps) {
  const { template } = answer;
  const rows = template.rules.map(asRow);
  const [editing, setEditing] = useState<Editing>(null);
  const [scope, setScope] = useState<Pick<RuleRowInput, "variant" | "warband_type_id">>({
    variant: "",
    warband_type_id: null,
  });
  const start = (next: Editing) => {
    const rule = next !== null && next !== "add" ? rows[next.index] : null;
    setScope({ variant: rule?.variant ?? "", warband_type_id: rule?.warband_type_id ?? null });
    setEditing(next);
    save.clearError();
  };
  const commit = async (next: RuleRowInput[]) => {
    if (await save.run(saveRules(next))) setEditing(null);
  };

  return (
    <section aria-label="Rules" className="flex flex-col gap-3">
      <div className="flex flex-col">
        {rows.map((rule, index) =>
          editing !== null && editing !== "add" && editing.index === index ? (
            <RuleForm
              key={rule.id}
              label={`Edit ${rule.title}`}
              initial={rule}
              submitLabel="Save rule"
              pending={save.pending}
              onSubmit={(payload) =>
                void commit(
                  rows.map((row, at) => (at === index ? { ...row, ...payload, ...scope } : row))
                )
              }
              onCancel={() => setEditing(null)}
              onDelete={() => void commit(rows.filter((_, at) => at !== index))}
            >
              <ScopeFields template={template} scope={scope} onChange={setScope} />
            </RuleForm>
          ) : (
            <article
              key={rule.id}
              aria-label={rule.title}
              className="flex flex-col gap-1 border-t border-line py-2.5 first:border-t-0"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="m-0 text-[15px] font-bold text-head">{rule.title}</h3>
                {editing === null ? (
                  <IconButton
                    aria-label={`Edit ${rule.title}`}
                    look="plain"
                    className="-my-1 h-8 w-8 shrink-0"
                    onClick={() => start({ index })}
                  >
                    <Pencil aria-hidden="true" />
                  </IconButton>
                ) : null}
              </div>
              {scopeOf(template, rule) ? (
                <span className="text-xs text-muted-foreground">{scopeOf(template, rule)}</span>
              ) : null}
              <Warnings warnings={warningsFor(answer.warnings, "rules", String(rule.id))} />
              {rule.description ? (
                <p className="m-0 line-clamp-3 whitespace-pre-line text-sm text-text2">
                  {rule.description}
                </p>
              ) : null}
            </article>
          )
        )}
      </div>
      {save.error ? <p className="m-0 text-xs font-semibold text-danger">{save.error}</p> : null}
      {editing === "add" ? (
        <RuleForm
          label="Add a rule"
          initial={{ title: "", description: "" }}
          submitLabel="Add rule"
          pending={save.pending}
          onSubmit={(payload) => void commit([...rows, { ...payload, ...scope }])}
          onCancel={() => setEditing(null)}
        >
          <ScopeFields template={template} scope={scope} onChange={setScope} />
        </RuleForm>
      ) : null}
      {editing === null ? (
        <button
          type="button"
          onClick={() => start("add")}
          className="min-h-9 self-start border border-dashed border-strong px-3 text-xs font-bold text-accent-text"
        >
          Add rule
        </button>
      ) : null}
    </section>
  );
}
