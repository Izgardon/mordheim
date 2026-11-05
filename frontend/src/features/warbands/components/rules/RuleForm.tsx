import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useReportDirty } from "@/components/ui/discard-changes";
import { Input } from "@/components/ui/input";

import type { WarbandRulePayload } from "../../types/warband-types";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const TEXTAREA =
  "min-h-[140px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const scrollTo = (node: HTMLElement | null) => node?.scrollIntoView?.({ block: "nearest" });

/**
 * A warband rule's title and description, to add one or edit one (with Delete, which asks again):
 * the warband's rules modal and the template editor's Rules, which adds the fields a template's
 * rule has besides (`children`: the variant and type it is for).
 */
export default function RuleForm({
  label,
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
  onDelete,
  children,
}: {
  label: string;
  initial: WarbandRulePayload;
  submitLabel: string;
  pending: boolean;
  onSubmit: (payload: WarbandRulePayload) => void;
  onCancel: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  // the template editor asks before it closes on a rule changed here (the rules modal doesn't ask)
  useReportDirty(title !== initial.title || description !== initial.description);
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
      {children}
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
