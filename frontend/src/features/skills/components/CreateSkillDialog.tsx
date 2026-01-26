import { useMemo, useState } from "react";
import type { FocusEvent, ReactNode } from "react";

// components
import { ActionSearchInput } from "@components/action-search-input";
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Input } from "@components/input";
import { Label } from "@components/label";

// api
import { createSkill } from "../api/skills-api";

// types
import type { Skill } from "../types/skill-types";

type CreateSkillDialogProps = {
  campaignId: number;
  onCreated: (skill: Skill) => void;
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SkillFormState = {
  name: string;
  type: string;
  description: string;
  typeCommitted: boolean;
};

const initialState: SkillFormState = {
  name: "",
  type: "",
  description: "",
  typeCommitted: false,
};

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

export default function CreateSkillDialog({
  campaignId,
  onCreated,
  typeOptions = [],
  trigger,
  open: openProp,
  onOpenChange,
}: CreateSkillDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<SkillFormState>(initialState);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);

  const resetForm = () => {
    setForm(initialState);
    setFormError("");
    setIsTypeMenuOpen(false);
  };

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setResolvedOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const normalizedTypeOptions = useMemo(() => {
    const unique = new Map<string, string>();
    const pushOption = (option: string) => {
      const trimmed = option.trim();
      if (!trimmed) {
        return;
      }
      const key = trimmed.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, trimmed);
      }
    };

    typeOptions.forEach(pushOption);
    customTypes.forEach(pushOption);

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [customTypes, typeOptions]);

  const trimmedType = form.type.trim();
  const typeQuery = trimmedType.toLowerCase();
  const filteredTypeOptions = useMemo(() => {
    if (!typeQuery) {
      return normalizedTypeOptions;
    }
    return normalizedTypeOptions.filter((option) => option.toLowerCase().includes(typeQuery));
  }, [normalizedTypeOptions, typeQuery]);

  const typeExists = Boolean(
    trimmedType &&
      normalizedTypeOptions.some((option) => option.toLowerCase() === typeQuery)
  );
  const canAddType = Boolean(trimmedType && !typeExists);

  const handleTypeBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsTypeMenuOpen(false);
  };

  const handleSelectType = (value: string) => {
    setForm((prev) => ({
      ...prev,
      type: value,
      typeCommitted: true,
    }));
    setIsTypeMenuOpen(false);
  };

  const handleAddType = () => {
    if (!trimmedType) {
      return;
    }
    if (!typeExists) {
      setCustomTypes((prev) => [trimmedType, ...prev]);
    }
    setForm((prev) => ({
      ...prev,
      type: trimmedType,
      typeCommitted: true,
    }));
    setIsTypeMenuOpen(false);
  };

  const handleCreate = async () => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create skill.");
      return;
    }

    if (!form.name.trim() || !form.type.trim() || !form.description.trim()) {
      setFormError("Name, type, and description are required.");
      return;
    }

    if (!form.typeCommitted) {
      setFormError("Add or select a type before saving.");
      return;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const newSkill = await createSkill({
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
        campaign_id: campaignId,
      });
      onCreated(newSkill);
      setResolvedOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to create skill");
      } else {
        setFormError("Unable to create skill");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const triggerNode = trigger === undefined ? <Button>Add skill</Button> : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a skill</DialogTitle>
          <DialogDescription>Record a new technique for this campaign.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Quick Hands"
              required
            />
          </div>
          <div
            className="relative space-y-2"
            onFocusCapture={() => setIsTypeMenuOpen(true)}
            onBlurCapture={handleTypeBlur}
          >
            <Label htmlFor="skill-type">Type</Label>
            <ActionSearchInput
              id="skill-type"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value,
                  typeCommitted: false,
                }))
              }
              placeholder="Search or add a type"
              actionLabel="Add type"
              actionAriaLabel="Add custom type"
              actionDisabled={!canAddType}
              onAction={handleAddType}
              required
              autoComplete="off"
            />
            {isTypeMenuOpen ? (
              filteredTypeOptions.length > 0 ? (
                <div className="absolute z-50 mt-2 max-h-40 w-full space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-2 text-sm shadow-[0_12px_20px_rgba(5,20,24,0.3)]">
                  {filteredTypeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleSelectType(option)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-accent/30"
                    >
                      <span className="font-medium">{formatTypeLabel(option)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="absolute z-50 mt-2 w-full rounded-2xl border border-border/60 bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-[0_12px_20px_rgba(5,20,24,0.3)]">
                  No matching types yet.
                </div>
              )
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-description">Description</Label>
            <textarea
              id="skill-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the skill."
              className="min-h-[120px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              required
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Saving..." : "Add skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

