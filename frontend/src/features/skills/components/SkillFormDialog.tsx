import { useEffect, useMemo, useState } from "react";
import type { FocusEvent, ReactNode } from "react";

import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
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
import { Tooltip } from "@components/tooltip";

import { createSkill, deleteSkill, updateSkill } from "../api/skills-api";

import type { Skill } from "../types/skill-types";

import editIcon from "@/assets/components/edit.webp";

type SkillFormState = {
  name: string;
  type: string;
  description: string;
  typeCommitted: boolean;
};

type SkillFormDialogBaseProps = {
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SkillFormDialogCreateProps = SkillFormDialogBaseProps & {
  mode: "create";
  campaignId: number;
  onCreated: (skill: Skill) => void;
};

type SkillFormDialogEditProps = SkillFormDialogBaseProps & {
  mode: "edit";
  skill: Skill;
  onUpdated: (skill: Skill) => void;
  onDeleted: (skillId: number) => void;
};

type SkillFormDialogProps = SkillFormDialogCreateProps | SkillFormDialogEditProps;

const initialState: SkillFormState = {
  name: "",
  type: "",
  description: "",
  typeCommitted: false,
};

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

const buildFormFromSkill = (skill: Skill): SkillFormState => ({
  name: skill.name ?? "",
  type: skill.type ?? "",
  description: skill.description ?? "",
  typeCommitted: true,
});

export default function SkillFormDialog(props: SkillFormDialogProps) {
  const {
    mode,
    typeOptions = [],
    trigger,
    open: openProp,
    onOpenChange,
  } = props;
  const skill = mode === "edit" ? props.skill : null;

  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [form, setForm] = useState<SkillFormState>(() =>
    mode === "edit" && skill ? buildFormFromSkill(skill) : initialState
  );
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const resetForm = () => {
    if (mode === "edit" && skill) {
      setForm(buildFormFromSkill(skill));
    } else {
      setForm(initialState);
    }
    setCustomTypes([]);
    setFormError("");
    setIsTypeMenuOpen(false);
  };

  useEffect(() => {
    if (!resolvedOpen) {
      return;
    }

    if (mode === "edit" && skill) {
      setForm(buildFormFromSkill(skill));
    }

    setCustomTypes([]);
    setFormError("");
    setIsTypeMenuOpen(false);
  }, [mode, resolvedOpen, skill]);

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
    if (mode === "edit" && skill?.type) {
      pushOption(skill.type);
    }

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [customTypes, mode, skill?.type, typeOptions]);

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
      resetForm();
      setIsDeleteOpen(false);
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

    if (mode === "create" && Number.isNaN(props.campaignId)) {
      setFormError("Unable to create skill.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      if (mode === "create") {
        const newSkill = await createSkill({
          name: form.name.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
          campaign_id: props.campaignId,
        });
        props.onCreated(newSkill);
      } else if (skill) {
        const updated = await updateSkill(skill.id, {
          name: form.name.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
        });
        props.onUpdated(updated);
      }
      setResolvedOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(
          errorResponse.message ||
            (mode === "create" ? "Unable to create skill" : "Unable to update skill")
        );
      } else {
        setFormError(mode === "create" ? "Unable to create skill" : "Unable to update skill");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (mode !== "edit" || !skill) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await deleteSkill(skill.id);
      props.onDeleted(skill.id);
      setResolvedOpen(false);
      setIsDeleteOpen(false);
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
    trigger === undefined
      ? mode === "create"
        ? <Button>Add skill</Button>
        : (
          <Tooltip
            trigger={
              <button
                type="button"
                aria-label="Edit skill"
                className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
              >
                <img src={editIcon} alt="" className="h-full w-full object-contain" />
              </button>
            }
            content="Edit"
          />
        )
      : trigger;

  const title = mode === "create" ? "Add Skill" : "Edit Skill";
  const idSuffix = mode === "edit" && skill ? `-${skill.id}` : "";

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: "#a78f79" }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`skill-name${idSuffix}`}>Name</Label>
            <Input
              id={`skill-name${idSuffix}`}
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
            <Label htmlFor={`skill-type${idSuffix}`}>Type</Label>
            <ActionSearchInput
              id={`skill-type${idSuffix}`}
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
              <ActionSearchDropdown
                open={isTypeMenuOpen}
                onClose={() => setIsTypeMenuOpen(false)}
                className="z-50 rounded-2xl"
              >
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
            <Label htmlFor={`skill-description${idSuffix}`}>Description</Label>
            <textarea
              id={`skill-description${idSuffix}`}
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
        <DialogFooter
          className={mode === "edit" ? "flex flex-wrap items-center justify-between gap-3" : undefined}
        >
          {mode === "edit" ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isSaving}
            >
              Delete
            </Button>
          ) : null}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving
              ? "Saving..."
              : mode === "create"
                ? "Add skill"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {mode === "edit" && skill ? (
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          description={
            <span>
              Delete <span className="font-semibold text-foreground">{skill.name}</span>?
              This action cannot be undone.
            </span>
          }
          confirmText={isSaving ? "Deleting..." : "Delete skill"}
          confirmDisabled={isSaving}
          isConfirming={isSaving}
          onConfirm={handleDelete}
          onCancel={() => setIsDeleteOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}
