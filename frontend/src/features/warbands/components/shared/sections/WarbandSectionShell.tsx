import type { ReactNode } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { cn } from "@/lib/utils";

type WarbandSectionShellProps = {
  title: string;
  titleSuffix?: ReactNode;
  isEditing?: boolean;
  canEdit?: boolean;
  variant?: "card" | "plain";
  className?: string;
  headerClassName?: string;
  actionsClassName?: string;
  editLabel?: string;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isLoadingDetails?: boolean;
  status?: ReactNode;
  saveError?: string;
  pendingSpend?: number;
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
  editLabel,
  onEdit,
  onCancel,
  onSave,
  isSaving = false,
  isLoadingDetails = false,
  status,
  saveError,
  pendingSpend = 0,
  availableGold = 0,
  children,
}: WarbandSectionShellProps) {
  const Wrapper = variant === "card" ? CardBackground : "div";
  const wrapperClassName = cn(
    variant === "card"
      ? `warband-section-hover ${isEditing ? "warband-section-editing" : ""} space-y-4 p-7`
      : "space-y-4",
    className
  );

  return (
    <Wrapper className={wrapperClassName}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", headerClassName)}>
        <h2 className="flex items-baseline gap-2 text-3xl font-bold" style={{ color: "#a78f79" }}>
          <span>{title}</span>
          {titleSuffix ? (
            <span className="text-sm font-semibold text-muted-foreground">{titleSuffix}</span>
          ) : null}
        </h2>
        <div className={cn("section-edit-actions ml-auto flex items-center gap-2", actionsClassName)}>
          {!isEditing && canEdit && onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={isLoadingDetails}
            >
              {isLoadingDetails ? "Loading..." : editLabel ?? `Edit ${title}`}
            </Button>
          ) : null}
          {isEditing && canEdit ? (
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
      {isEditing && pendingSpend > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Pending spend: {pendingSpend} gc - Gold after pending: {Math.max(availableGold - pendingSpend, 0)} gc
        </div>
      ) : null}

      {children}
    </Wrapper>
  );
}
