import { useState } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";

import CommonRulesSheet from "./CommonRulesSheet";

import type { HouseRule, HouseRulePayload } from "../types/rule-types";

type HouseRuleFormProps = {
  campaignId: number;
  rules: HouseRule[];
  form: HouseRulePayload;
  onFieldChange: (field: keyof HouseRulePayload, value: string) => void;
  formError: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onCommonRulesApplied: (rules: HouseRule[], outcome: { allApplied: boolean }) => void;
};

/** The new-rule form (`manage_rules`), with the Common Rules sheet to pick from. */
export default function HouseRuleForm({
  campaignId,
  rules,
  form,
  onFieldChange,
  formError,
  isSubmitting,
  onCancel,
  onSubmit,
  onCommonRulesApplied,
}: HouseRuleFormProps) {
  const [isCommonRulesOpen, setIsCommonRulesOpen] = useState(false);

  return (
    <div className="space-y-3 border border-accent-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-faint">New Rule</h4>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setIsCommonRulesOpen(true)}
          disabled={isSubmitting}
        >
          Common Rules
        </Button>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Title</label>
          <Input
            value={form.title}
            onChange={(event) => onFieldChange("title", event.target.value)}
            placeholder="Parry changes"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Description</label>
          <textarea
            className="min-h-[140px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            value={form.description}
            onChange={(event) => onFieldChange("description", event.target.value)}
            placeholder="Describe the ruling and any clarifications."
          />
        </div>
      </div>
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Add rule"}
        </Button>
      </div>
      <CommonRulesSheet
        campaignId={campaignId}
        existingRules={rules}
        open={isCommonRulesOpen}
        onOpenChange={setIsCommonRulesOpen}
        onApplied={onCommonRulesApplied}
      />
    </div>
  );
}
