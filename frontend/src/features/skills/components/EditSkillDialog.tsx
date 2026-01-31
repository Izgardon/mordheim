import { useEffect, useMemo, useState } from "react";
import type { FocusEvent, ReactNode } from "react";

// components
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
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
import { Label } from "@components/label";

// api
import { deleteSkill, updateSkill } from "../api/skills-api";

// types
import type { Skill } from "../types/skill-types";

type EditSkillDialogProps = {
  skill: Skill;
  typeOptions?: string[];
  onUpdated: (skill: Skill) => void;
  onDeleted: (skillId: number) => void;
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

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

export default function EditSkillDialog({
  skill,
  typeOptions = [],
  onUpdated,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
}: EditSkillDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<SkillFormState>({
    name: skill.name ?? "",
    type: skill.type ?? "",
    description: skill.description ?? "",
    typeCommitted: true,
  });
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (resolvedOpen) {
      setForm({
        name: skill.name ?? "",
        type: skill.type ?? "",
        description: skill.description ?? "",
        typeCommitted: true,
      });
      setCustomTypes([]);
      setFormError("");
      setIsTypeMenuOpen(false);
    }
  }, [resolvedOpen, skill]);

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
    if (skill.type) {
      pushOption(skill.type);
    }

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [customTypes, skill.type, typeOptions]);

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

  const handleOpenChange = (nextOpen: boolean) => {
    setResolvedOpen(nextOpen);
    if (!nextOpen) {
      setFormError("");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.type.trim() || !form.description.trim()) {
      setFormError("Name, type, and description are required.");
      return;
    }

    if (!form.typeCommitted) {
      setFormError("Add or select a type before saving.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const updated = await updateSkill(skill.id, {
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
      });
      onUpdated(updated);
      setResolvedOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to update skill");
      } else {
        setFormError("Unable to update skill");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${skill.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await deleteSkill(skill.id);
      onDeleted(skill.id);
      setResolvedOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to delete skill");
      } else {
        setFormError("Unable to delete skill");
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
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>EDIT SKILL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-skill-name-${skill.id}`}>Name</Label>
            <Input
              id={`edit-skill-name-${skill.id}`}
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
            <Label htmlFor={`edit-skill-type-${skill.id}`}>Type</Label>
            <ActionSearchInput
              id={`edit-skill-type-${skill.id}`}
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
            >
              <ActionSearchDropdown open={isTypeMenuOpen} onClose={() => setIsTypeMenuOpen(false)} className="z-50 rounded-2xl">
                {filteredTypeOptions.length > 0 ? (
                  <div className="max-h-40 w-full overflow-y-auto p-2 text-sm">
                    <div className="space-y-1">
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
                  </div>
                ) : (
                  <div className="w-full px-3 py-2 text-xs text-muted-foreground">
                    No matching types yet.
                  </div>
                )}
              </ActionSearchDropdown>
            </ActionSearchInput>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-skill-description-${skill.id}`}>Description</Label>
            <textarea
              id={`edit-skill-description-${skill.id}`}
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
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" type="button" onClick={handleDelete} disabled={isSaving}>
            Delete
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
