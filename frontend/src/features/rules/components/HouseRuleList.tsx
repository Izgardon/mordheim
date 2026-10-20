import { ListSkeleton } from "@components/card-skeleton";

import EditHouseRuleDialog from "./EditHouseRuleDialog";

import type { HouseRule } from "../types/rule-types";

type HouseRuleListProps = {
  campaignId: number;
  rules: HouseRule[];
  isLoading: boolean;
  canManageRules: boolean;
  onUpdated: (rule: HouseRule) => void;
  onDeleted: (ruleId: number) => void;
};

/** The rules ledger, with Edit on each rule for those who manage rules. */
export default function HouseRuleList({
  campaignId,
  rules,
  isLoading,
  canManageRules,
  onUpdated,
  onDeleted,
}: HouseRuleListProps) {
  if (isLoading) {
    return <ListSkeleton count={4} />;
  }
  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground">No house rules logged yet.</p>;
  }
  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div key={rule.id} className="surface-panel-strong rounded-2xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{rule.title}</p>
            {canManageRules ? (
              <EditHouseRuleDialog
                campaignId={campaignId}
                rule={rule}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            ) : null}
          </div>
          {rule.description ? (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
              {rule.description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
