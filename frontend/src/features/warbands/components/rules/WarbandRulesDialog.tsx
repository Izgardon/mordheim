import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/icon-button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useRuleCreate, useRuleDelete, useRuleUpdate } from "../../api/rule-queries";
import type { WarbandRule } from "../../types/warband-types";
import AddTemplateRules from "./AddTemplateRules";
import RuleForm from "./RuleForm";

/** Where the modal opens: at one rule (its pill), on the add form, or at the top. */
export type RulesOpening = { ruleId?: number; adding?: boolean };

type Editing = { kind: "add" } | { kind: "edit"; rule: WarbandRule } | null;

const scrollTo = (node: HTMLElement | null) => node?.scrollIntoView?.({ block: "nearest" });

/**
 * The warband's rules in one modal (a bottom sheet on a phone): every rule's title and
 * description, the one its pill opened at picked out. The warband's editors add, edit and delete
 * them here, and with a campaign given, Add the template's rules copies the missing ones.
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
  /** The warband's campaign: its template is read for Add the template's rules. */
  campaignId?: number;
  warbandId?: number;
  warbandName: string;
  rules: WarbandRule[];
  canEdit: boolean;
}) {
  const create = useRuleCreate(warbandId ?? 0); // none: read only (canEdit is off)
  const update = useRuleUpdate(warbandId ?? 0);
  const remove = useRuleDelete(warbandId ?? 0);
  const [editing, setEditing] = useState<Editing>(null);
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const done = { onSuccess: () => setEditing(null), onError };

  useEffect(() => {
    if (open) setEditing(opening.adding && canEdit ? { kind: "add" } : null);
  }, [open, opening, canEdit]);

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={warbandName}
      title="Warband rules"
      className="max-w-[720px]"
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
      {canEdit && editing?.kind === "add" ? (
        <RuleForm
          label="Add a rule"
          initial={{ title: "", description: "" }}
          submitLabel="Add rule"
          pending={create.isPending}
          onSubmit={(payload) => create.mutate(payload, done)}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      {canEdit && !editing ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing({ kind: "add" })}
            className="min-h-9 self-start border border-dashed border-strong px-3 text-xs font-bold text-accent-text"
          >
            Add rule
          </button>
          {campaignId && warbandId ? (
            <AddTemplateRules campaignId={campaignId} warbandId={warbandId} open={open} />
          ) : null}
        </div>
      ) : null}
    </ModalSheet>
  );
}
