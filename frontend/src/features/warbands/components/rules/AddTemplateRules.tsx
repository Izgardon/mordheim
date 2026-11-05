import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import { useRulesFromTemplate } from "../../api/rule-queries";
import { useWarbandHireTemplate } from "../../api/warband-template-queries";

/**
 * Add the template's rules (the templates plan, "Warband rules"): copies the rules of the
 * warband's template, for its variant and type, whose title it doesn't have yet, leaving the rest
 * alone. Shown only to its editors, and only when some are missing.
 */
export default function AddTemplateRules({
  campaignId,
  warbandId,
  open,
}: {
  campaignId: number;
  warbandId: number;
  /** The rules modal is open: the template is read only then. */
  open: boolean;
}) {
  const template = useWarbandHireTemplate(campaignId, warbandId, open).data?.template;
  const add = useRulesFromTemplate(warbandId);
  if (!template?.missing_rules) return null;
  return (
    <button
      type="button"
      disabled={add.isPending}
      onClick={() =>
        add.mutate(undefined, { onError: (error) => toast.error(getErrorMessage(error)) })
      }
      className="min-h-9 self-start border border-dashed border-strong px-3 text-xs font-bold text-accent-text"
    >
      Add the template&apos;s rules
    </button>
  );
}
