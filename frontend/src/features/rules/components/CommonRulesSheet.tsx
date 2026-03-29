import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";

import { createHouseRule } from "../api/rules-api";

import type { HouseRule } from "../types/rule-types";

type CommonRulesSheetProps = {
  campaignId: number;
  existingRules: HouseRule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (rules: HouseRule[]) => void;
};

type CommonRuleDefinition = {
  id: string;
  title: string;
  description: string;
};

const COMMON_RULES: CommonRuleDefinition[] = [
  {
    id: "ranged-weapon-limitations",
    title: "Ranged Weapon Limitations",
    description:
      "Only half of the models in your warband, including hired swords, can be armed with missile weapons, rounding up (e.g., 6 members in a 11-man warband may have missile weapons).",
  },
];

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
    const selectedRules = COMMON_RULES.filter(
      (rule) =>
        selectedIds.includes(rule.id) &&
        !existingTitles.has(normalizeRuleTitle(rule.title))
    );

    if (selectedRules.length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const created = await Promise.all(
        selectedRules.map((rule) =>
          createHouseRule(campaignId, {
            title: rule.title,
            description: rule.description,
          })
        )
      );
      onApplied(created);
      onOpenChange(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to add common rules");
      } else {
        setError("Unable to add common rules");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: "#a78f79" }}>
            Common Rules
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose from a small list of commonly used campaign house rules.
          </p>
          <div className="space-y-3">
            {COMMON_RULES.map((rule) => {
              const isAlreadyApplied = existingTitles.has(normalizeRuleTitle(rule.title));
              const isChecked = selectedIds.includes(rule.id);

              return (
                <label
                  key={rule.id}
                  className={[
                    "flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-[0_12px_22px_rgba(5,20,24,0.25)]",
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
                      <p className="text-sm font-semibold text-foreground">{rule.title}</p>
                      {isAlreadyApplied ? (
                        <span className="rounded bg-background/70 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                          Applied
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedIds.length === 0}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
