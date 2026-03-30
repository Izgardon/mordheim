import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown, Pencil } from "lucide-react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { cn } from "@/lib/utils";

import type { PendingChangeItem } from "../../../utils/pending-purchases";

type WarbandSectionShellProps = {
  title: string;
  titleSuffix?: ReactNode;
  isEditing?: boolean;
  canEdit?: boolean;
  variant?: "card" | "plain";
  className?: string;
  headerClassName?: string;
  actionsClassName?: string;
  actionsHidden?: boolean;
  editLabel?: string;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isLoadingDetails?: boolean;
  status?: ReactNode;
  saveError?: string;
  pendingSpend?: number;
  pendingChanges?: PendingChangeItem[];
  availableGold?: number;
  children: ReactNode;
};

export default function WarbandSectionShell({
  title,
  titleSuffix,
  isEditing = false,
  canEdit = false,
  variant = "card",
  className,
  headerClassName,
  actionsClassName,
  actionsHidden = false,
  editLabel,
  onEdit,
  onCancel,
  onSave,
  isSaving = false,
  isLoadingDetails = false,
  status,
  saveError,
  pendingSpend: pendingSpendProp = 0,
  pendingChanges,
  availableGold = 0,
  children,
}: WarbandSectionShellProps) {
  const pendingSpend = pendingChanges
    ? pendingChanges.reduce((s, c) => s + c.amount, 0)
    : pendingSpendProp;
  const [changesExpanded, setChangesExpanded] = useState(false);

  useEffect(() => {
    if (!isEditing) setChangesExpanded(false);
  }, [isEditing]);
  const Wrapper = variant === "card" ? CardBackground : "div";
  const wrapperClassName = cn(
    variant === "card"
      ? `warband-section-hover ${isEditing ? "warband-section-editing" : ""} space-y-4 bg-[rgba(12,9,6,0.92)] p-7`
      : "space-y-4",
    className
  );

  const titleClassName = cn(
    "flex items-baseline gap-2",
    variant === "plain"
      ? "text-lg font-semibold uppercase tracking-[0.2em] pl-1"
      : "text-3xl font-bold"
  );
  const suffixClassName = cn(
    "font-semibold text-muted-foreground",
    variant === "plain" ? "text-xs" : "text-sm"
  );
  const titleColor = variant === "plain" ? "#d6c1a2" : "#a78f79";

  return (
    <Wrapper className={wrapperClassName}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 py-2", headerClassName)}>
        <h2 className={titleClassName} style={{ color: titleColor }}>
          <span>{title}</span>
          {titleSuffix ? (
            <span className={suffixClassName}>{titleSuffix}</span>
          ) : null}
        </h2>
        <div
          className={cn(
            "section-edit-actions ml-auto flex items-center gap-2",
            actionsClassName,
            actionsHidden && "hidden"
          )}
        >
          {!actionsHidden && !isEditing && canEdit && onEdit ? (
            <>
              <button
                type="button"
                aria-label={isLoadingDetails ? "Loading..." : editLabel ?? `Edit ${title}`}
                onClick={onEdit}
                disabled={isLoadingDetails}
                className="icon-button flex h-9 w-9 shrink-0 items-center justify-center transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 text-muted-foreground min-[960px]:hidden"
              >
                <Pencil className="h-5 w-5" aria-hidden="true" />
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={isLoadingDetails}
                className="hidden min-[960px]:inline-flex"
              >
                {isLoadingDetails ? "Loading..." : editLabel ?? `Edit ${title}`}
              </Button>
            </>
          ) : null}
          {!actionsHidden && isEditing && canEdit ? (
            <>
              {onCancel ? (
                <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
              {onSave ? (
                <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {status}
      {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      {isEditing && (pendingSpend > 0 || (pendingChanges && pendingChanges.length > 0)) ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2"
            onClick={() => pendingChanges && setChangesExpanded((p) => !p)}
          >
            <span>
              Pending spend: {pendingSpend} gc &mdash; Gold after pending:{" "}
              {Math.max(availableGold - pendingSpend, 0)} gc
            </span>
            {pendingChanges ? (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  changesExpanded ? "rotate-0" : "-rotate-90",
                )}
              />
            ) : null}
          </button>
          {changesExpanded && pendingChanges ? (
            <ul className="mt-2 space-y-0.5 border-t border-amber-500/20 pt-2">
              {pendingChanges
                .filter((c) => c.amount > 0 || c.category === "stash_consume")
                .map((change, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {change.quantity > 1
                        ? `${change.label} x${change.quantity}`
                        : change.label}
                    </span>
                    <span className="shrink-0">
                      {change.amount > 0 ? `${change.amount} gc` : "free"}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {children}
    </Wrapper>
  );
}
