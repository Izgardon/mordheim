import type { ReactNode } from "react";

import { ruleLabel } from "@/features/catalogue/utils/entry-status";
import { ReferenceRow } from "@/features/reference/ReferenceList";
import RulesPanel from "@/features/warbands/components/roster/RulesPanel";

import type { HouseRule } from "../types/rule-types";

/** "Changes the game" for a rule with an effect, else plain "House rule". */
const kindOf = (rule: HouseRule) =>
  rule.effect_key ? `House rule · ${ruleLabel(rule.effect_key)}` : "House rule";

/**
 * A house rule as a row that opens to its text in the warband page's rules panel: the House rules
 * page's (`children` its Edit button), and the battle Rules sheet's House rules.
 */
export default function HouseRuleRow({
  rule,
  open,
  onToggle,
  onClose,
  isMobile,
  children,
}: {
  rule: HouseRule;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  isMobile: boolean;
  children?: ReactNode;
}) {
  return (
    <ReferenceRow
      id={String(rule.id)}
      open={open}
      onToggle={onToggle}
      name={rule.title}
      sub={kindOf(rule)}
    >
      <div className={isMobile ? "flex flex-col gap-2" : "flex flex-col gap-2 px-3 pb-4"}>
        <RulesPanel
          detail={{ name: rule.title, kind: kindOf(rule), text: rule.description }}
          onClose={onClose}
        />
        {children}
      </div>
    </ReferenceRow>
  );
}
