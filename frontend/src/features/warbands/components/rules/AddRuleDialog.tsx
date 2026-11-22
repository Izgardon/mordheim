import { toast } from "sonner";

import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

import { useRuleCreate } from "../../api/rule-queries";
import AddTemplateRules from "./AddTemplateRules";
import RuleForm from "./RuleForm";

/**
 * Add rule, a form of its own (William, 22 Nov 2026: "The add warband rule form should be its own
 * form, not part of the warband rules modal"): a title and a description, saved as one of the
 * warband's rules. With a campaign given, Add the template's rules sits under it, so a warband
 * with no rules yet still reaches its template's.
 */
export default function AddRuleDialog({
  open,
  onOpenChange,
  campaignId,
  warbandId,
  warbandName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: number;
  warbandId: number;
  warbandName: string;
}) {
  const create = useRuleCreate(warbandId);
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={warbandName}
      title="Add rule"
      className="max-w-[560px]"
      closeButton
    >
      <div className="flex flex-col gap-3">
        <RuleForm
          label="Add a rule"
          initial={{ title: "", description: "" }}
          submitLabel="Add rule"
          pending={create.isPending}
          onSubmit={(payload) =>
            create.mutate(payload, {
              onSuccess: () => onOpenChange(false),
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
          onCancel={() => onOpenChange(false)}
        />
        {campaignId ? (
          <AddTemplateRules campaignId={campaignId} warbandId={warbandId} open={open} />
        ) : null}
      </div>
    </ModalSheet>
  );
}
