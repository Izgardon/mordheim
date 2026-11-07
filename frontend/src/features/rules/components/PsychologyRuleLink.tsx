import { Link, useParams } from "react-router-dom";

import { psychologyRule, psychologyRulePath } from "../psychology-rules";

/**
 * "Fear in the rules": a psychology special's link to the Rules page's part on it, inside a
 * campaign; nothing for a special that has none.
 */
export default function PsychologyRuleLink({ specialName }: { specialName: string }) {
  const { id } = useParams();
  const rule = psychologyRule(specialName);
  if (!rule || !id) return null;
  return (
    <Link
      to={psychologyRulePath(id, rule)}
      className="self-start text-[13px] font-semibold text-accent-text hover:text-accent-hi"
    >
      {rule.title} in the rules
    </Link>
  );
}
