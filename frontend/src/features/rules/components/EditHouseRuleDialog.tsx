import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Input } from "@components/input";
import { ConfirmDialog } from "@components/confirm-dialog";

// api
import { deleteHouseRule, updateHouseRule } from "../api/rules-api";

// types
import type { HouseRule, HouseRulePayload } from "../types/rule-types";

type EditHouseRuleDialogProps = {
  campaignId: number;
  rule: HouseRule;
  onUpdated: (rule: HouseRule) => void;
  onDeleted: (ruleId: number) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function EditHouseRuleDialog({
  campaignId,
  rule,
  onUpdated,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
}: EditHouseRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [form, setForm] = useState<HouseRulePayload>({
    title: rule.title ?? "",
    description: rule.description ?? "",
  });

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (resolvedOpen) {
      setForm({ title: rule.title ?? "", description: rule.description ?? "" });
      setFormError("");
    }
  }, [resolvedOpen, rule]);

  const handleOpenChange = (nextOpen: boolean) => {
    setResolvedOpen(nextOpen);
    if (!nextOpen) {
      setFormError("");
    }
  };

  const handleSave = async () => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to update house rule.");
      return;
    }
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const updated = await updateHouseRule(campaignId, rule.id, {
        title: form.title.trim(),
        description: form.description.trim(),
      });
      onUpdated(updated);
      setResolvedOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to update house rule");
      } else {
        setFormError("Unable to update house rule");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setFormError("");

    try {
      await deleteHouseRule(campaignId, rule.id);
      onDeleted(rule.id);
      setResolvedOpen(false);
      setIsDeleteOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to delete house rule");
      } else {
        setFormError("Unable to delete house rule");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const triggerNode =
    trigger === undefined ? (
      <Button variant="outline" size="sm">
        Edit
      </Button>
    ) : (
      trigger
    );

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>EDIT HOUSE RULE</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Title</label>
            <Input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Shared exploration loot"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Description</label>
            <textarea
              className="min-h-[140px] w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Describe the ruling and any clarifications."
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isSaving}
          >
            Delete
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !form.title.trim()}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        description={
          <span>
            Delete <span className="font-semibold text-foreground">{rule.title}</span>? This
            action cannot be undone.
          </span>
        }
        confirmText={isSaving ? "Deleting..." : "Delete rule"}
        confirmDisabled={isSaving}
        isConfirming={isSaving}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </Dialog>
  );
}
