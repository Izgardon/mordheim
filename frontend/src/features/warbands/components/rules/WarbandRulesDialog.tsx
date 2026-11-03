import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useRuleCreate, useRuleDelete, useRuleUpdate } from "../../api/rule-queries";
import type { WarbandRule, WarbandRulePayload } from "../../types/warband-types";

/** Where the modal opens: at one rule (its pill), on the add form, or at the top. */
export type RulesOpening = { ruleId?: number; adding?: boolean };

type Editing = { kind: "add" } | { kind: "edit"; rule: WarbandRule } | null;

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const TEXTAREA =
  "min-h-[140px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const scrollTo = (node: HTMLElement | null) => node?.scrollIntoView?.({ block: "nearest" });

/** A rule's title and description, to add one or edit one (with Delete, which asks again). */
function RuleForm({
  label,
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
  onDelete,
}: {
  label: string;
  initial: WarbandRulePayload;
  submitLabel: string;
  pending: boolean;
  onSubmit: (payload: WarbandRulePayload) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [confirming, setConfirming] = useState(false);

  return (
    <form
      ref={scrollTo}
      aria-label={label}
      className="flex flex-col gap-3 border border-accent-line bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) onSubmit({ title: title.trim(), description: description.trim() });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Title</span>
        <Input
          autoFocus
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Description</span>
        <textarea
          maxLength={8000}
          className={TEXTAREA}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {onDelete ? (
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => (confirming ? onDelete() : setConfirming(true))}
          >
            {confirming ? "Delete for good" : "Delete"}
          </Button>
        ) : null}
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={pending || !title.trim()}>
            {submitLabel}
          </Button>
        </span>
      </div>
    </form>
  );
}

/**
 * The warband's rules in one modal (a bottom sheet on a phone): every rule's title and
 * description, the one its pill opened at picked out. The warband's editors add, edit and delete
 * them here.
 */
export default function WarbandRulesDialog({
  open,
  onOpenChange,
  opening,
  warbandId,
  warbandName,
  rules,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opening: RulesOpening;
  warbandId: number;
  warbandName: string;
  rules: WarbandRule[];
  canEdit: boolean;
}) {
  const create = useRuleCreate(warbandId);
  const update = useRuleUpdate(warbandId);
  const remove = useRuleDelete(warbandId);
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
        <button
          type="button"
          onClick={() => setEditing({ kind: "add" })}
          className="min-h-9 self-start border border-dashed border-strong px-3 text-xs font-bold text-accent-text"
        >
          Add rule
        </button>
      ) : null}
    </ModalSheet>
  );
}
