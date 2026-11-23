import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import { useRulesFromTemplate } from "../../api/rule-queries";
import { useWarbandHireTemplate } from "../../api/warband-template-queries";

/**
 * Add missing rules: copies the rules of the warband's template, for its variant and type, then
 * its campaign's preset's rules for its type or race (William, 23 Nov 2026), each whose title it
 * doesn't have yet, leaving the rest alone. Shown only to its editors, and only while the server
 * counts some missing (`missing_rules`), template or none.
 */
export default function AddMissingRules({
  campaignId,
  warbandId,
  open,
}: {
  campaignId: number;
  warbandId: number;
  /** The rules modal is open: the template is read only then. */
  open: boolean;
}) {
  const missing = useWarbandHireTemplate(campaignId, warbandId, open).data?.missing_rules;
  const add = useRulesFromTemplate(warbandId);
  if (!missing) return null;
  return (
    <button
      type="button"
      disabled={add.isPending}
      onClick={() =>
        add.mutate(undefined, { onError: (error) => toast.error(getErrorMessage(error)) })
      }
      className="min-h-9 self-start border border-dashed border-strong px-3 text-xs font-bold text-accent-text"
    >
      Add missing rules
    </button>
  );
}
