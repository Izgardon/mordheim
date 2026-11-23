import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/icon-button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useRuleDelete, useRuleUpdate } from "../../api/rule-queries";
import type { WarbandRule } from "../../types/warband-types";
import AddMissingRules from "./AddMissingRules";
import RuleForm from "./RuleForm";

/** Where the modal opens: at one rule (its pill), or at the top. */
export type RulesOpening = { ruleId?: number };

type Editing = { kind: "edit"; rule: WarbandRule } | null;

const scrollTo = (node: HTMLElement | null) => node?.scrollIntoView?.({ block: "nearest" });

/**
 * The warband's rules in one modal (a bottom sheet on a phone): every rule's title and
 * description, the one its pill opened at picked out. The warband's editors edit and delete them
 * here (adding is the section's Add rule, a form of its own), and with a campaign given, Add
 * missing rules copies its template's and its preset's it lacks.
 */
export default function WarbandRulesDialog({
  open,
  onOpenChange,
  opening,
  campaignId,
  warbandId,
  warbandName,
  rules,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opening: RulesOpening;
  /** The warband's campaign: its template is read for Add missing rules. */
  campaignId?: number;
  warbandId?: number;
  warbandName: string;
  rules: WarbandRule[];
  canEdit: boolean;
}) {
  const update = useRuleUpdate(warbandId ?? 0);
  const remove = useRuleDelete(warbandId ?? 0);
  const [editing, setEditing] = useState<Editing>(null);
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const done = { onSuccess: () => setEditing(null), onError };

  useEffect(() => {
    if (open) setEditing(null);
  }, [open, opening]);

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={warbandName}
      title="Warband rules"
      className="max-w-[720px]"
      closeButton
    >
      <div className="flex flex-col">
        {rules.map((rule) =>
          editing?.kind === "edit" && editing.rule.id === rule.id ? (
            <RuleForm
              key={rule.id}
              label={`Edit ${rule.title}`}
              initial={rule}
              submitLabel="Save changes"
              pending={update.isPending || remove.isPending}
              onSubmit={(payload) => update.mutate({ ruleId: rule.id, ...payload }, done)}
              onCancel={() => setEditing(null)}
              onDelete={() => remove.mutate(rule.id, done)}
            />
          ) : (
            <article
              key={rule.id}
              ref={rule.id === opening.ruleId ? scrollTo : undefined}
              aria-label={rule.title}
              data-opened={rule.id === opening.ruleId || undefined}
              className={cn(
                "flex flex-col gap-1 border-t border-line px-3 py-3 first:border-t-0",
                rule.id === opening.ruleId && "bg-accent-soft"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="m-0 font-bold text-head">{rule.title}</h3>
                {canEdit && !editing ? (
                  <IconButton
                    aria-label={`Edit ${rule.title}`}
                    look="plain"
                    className="-my-1 h-8 w-8 shrink-0"
                    onClick={() => setEditing({ kind: "edit", rule })}
                  >
                    <Pencil aria-hidden="true" />
                  </IconButton>
                ) : null}
              </div>
              {rule.description ? (
                <p className="m-0 whitespace-pre-line text-sm text-text2">{rule.description}</p>
              ) : null}
            </article>
          )
        )}
      </div>
      {/* Add rule is the section's own form (William, 22 Nov 2026); Add missing rules stays here */}
      {canEdit && !editing && campaignId && warbandId ? (
        <AddMissingRules campaignId={campaignId} warbandId={warbandId} open={open} />
      ) : null}
    </ModalSheet>
  );
}
