import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@components/dialog";

import { getErrorMessage } from "@/lib/get-error-message";

import { createHouseRule } from "../api/rules-api";
import { useCommonRules } from "../api/rule-queries";
import { takeHouseRuleWarnings } from "../utils/house-rule-warnings";

import type { CommonRule, HouseRule } from "../types/rule-types";

const NO_COMMON_RULES: CommonRule[] = [];

type CommonRulesSheetProps = {
  campaignId: number;
  existingRules: HouseRule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rules the server now holds (new, or one it already had); `allApplied` if none failed. */
  onApplied: (rules: HouseRule[], outcome: { allApplied: boolean }) => void;
};

function normalizeRuleTitle(value: string) {
  return value.trim().toLowerCase();
}

export default function CommonRulesSheet({
  campaignId,
  existingRules,
  open,
  onOpenChange,
  onApplied,
}: CommonRulesSheetProps) {
  // The server's list (IMP-69), read when the new-rule form opens with this sheet.
  const commonRulesQuery = useCommonRules(campaignId);
  const commonRules = commonRulesQuery.data ?? NO_COMMON_RULES;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const existingTitles = useMemo(
    () => new Set(existingRules.map((rule) => normalizeRuleTitle(rule.title))),
    [existingRules]
  );

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setError("");
      setIsSaving(false);
    }
  }, [open]);

  const handleToggle = (ruleId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(ruleId) ? current : [...current, ruleId];
      }
      return current.filter((id) => id !== ruleId);
    });
  };

  const handleSave = async () => {
    const selectedRules = commonRules.filter(
      (rule) => selectedIds.includes(rule.id) && !existingTitles.has(normalizeRuleTitle(rule.title))
    );

    if (selectedRules.length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError("");

    // Each rule stands alone (BUG-52): the ones the server created join the list even when
    // another fails, and only the failures stay picked, so Save retries just those.
    const results = await Promise.allSettled(
      selectedRules.map((rule) =>
        createHouseRule(campaignId, {
          title: rule.title,
          description: rule.description,
          effect_key: rule.effect_key,
        })
      )
    );
    // A rule with item effects may skip the campaign's own versions (house_rule_skipped).
    const created = results.flatMap((result) =>
      result.status === "fulfilled" ? [takeHouseRuleWarnings(result.value)] : []
    );
    const failures = results.flatMap((result, index) =>
      result.status === "rejected" ? [{ rule: selectedRules[index], reason: result.reason }] : []
    );
    setIsSaving(false);
    if (created.length > 0 || failures.length === 0) {
      onApplied(created, { allApplied: failures.length === 0 });
    }
    if (failures.length === 0) {
      onOpenChange(false);
      return;
    }
    setSelectedIds(failures.map((failure) => failure.rule.id));
    setError(
      failures
        .map(
          (failure) =>
            `Couldn't add ${failure.rule.title}: ${getErrorMessage(failure.reason, "please try again.")}`
        )
        .join(" ")
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogKicker>House rules</DialogKicker>
          <DialogTitle>Common rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <DialogDescription className="block text-sm text-text2">
            Choose from a small list of commonly used campaign house rules.
          </DialogDescription>
          {commonRulesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading common rules...</p>
          ) : null}
          {commonRulesQuery.error ? (
            <p className="text-sm text-danger">
              {getErrorMessage(commonRulesQuery.error, "Couldn't load the common rules.")}
            </p>
          ) : null}
          <div className="space-y-3">
            {commonRules.map((rule) => {
              const isAlreadyApplied = existingTitles.has(normalizeRuleTitle(rule.title));
              const isChecked = selectedIds.includes(rule.id);

              return (
                <label
                  key={rule.id}
                  className={[
                    "flex items-start gap-3 border border-border bg-surface p-4",
                    isAlreadyApplied ? "opacity-70" : "cursor-pointer",
                  ].join(" ")}
                >
                  <Checkbox
                    checked={isAlreadyApplied || isChecked}
                    disabled={isAlreadyApplied || isSaving}
                    onChange={(event) => handleToggle(rule.id, event.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{rule.title}</p>
                      {isAlreadyApplied ? (
                        <span className="border border-border px-[7px] py-px text-[11px] font-bold text-muted-foreground">
                          Applied
                        </span>
                      ) : null}
                      {rule.effect_key ? (
                        <span className="border border-accent-line bg-accent-soft px-[7px] py-px text-[11px] font-bold text-accent-hi">
                          Has game effects
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="text-xs text-muted-foreground">
            More house rule ideas can be found at{" "}
            <a
              href="https://www.mordheimer.net/docs/optional-rules/house-rules/hull"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-head"
            >
              mordheimer.net
            </a>
            .
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || selectedIds.length === 0}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
