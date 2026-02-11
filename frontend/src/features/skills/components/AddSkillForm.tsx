import { useEffect, useMemo, useState } from "react";
import type { FocusEvent } from "react";

import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { Input } from "@components/input";

import { createSkill, updateSkill, deleteSkill } from "../api/skills-api";

import type { Skill } from "../types/skill-types";

type AddSkillFormProps = {
  campaignId: number;
  onCreated: (skill: Skill) => void;
  onUpdated?: (skill: Skill) => void;
  onDeleted?: (skillId: number) => void;
  onCancel: () => void;
  typeOptions?: string[];
  editingSkill?: Skill | null;
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

const buildFormFromSkill = (skill: Skill): SkillFormState => ({
  name: skill.name ?? "",
  type: skill.type ?? "",
  description: skill.description ?? "",
  typeCommitted: true,
});

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

export default function AddSkillForm({
  campaignId,
  onCreated,
  onUpdated,
  onDeleted,
  onCancel,
  typeOptions = [],
  editingSkill,
}: AddSkillFormProps) {
  const isEditing = Boolean(editingSkill);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<SkillFormState>(() =>
    editingSkill ? buildFormFromSkill(editingSkill) : initialState
  );
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    if (editingSkill) {
      setForm(buildFormFromSkill(editingSkill));
    } else {
      setForm(initialState);
    }
    setCustomTypes([]);
    setFormError("");
    setIsTypeMenuOpen(false);
  }, [editingSkill]);

  const resetForm = () => {
    setForm(initialState);
    setCustomTypes([]);
    setFormError("");
    setIsTypeMenuOpen(false);
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

  const handleSave = async () => {
    if (!form.name.trim() || !form.type.trim() || !form.description.trim()) {
      setFormError("Name, type, and description are required.");
      return;
    }

    if (!form.typeCommitted) {
      setFormError("Add or select a type before saving.");
      return;
    }

    if (!isEditing && Number.isNaN(campaignId)) {
      setFormError("Unable to create skill.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      if (isEditing && editingSkill) {
        const updated = await updateSkill(editingSkill.id, {
          name: form.name.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
        });
        onUpdated?.(updated);
        resetForm();
      } else {
        const newSkill = await createSkill({
          name: form.name.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
          campaign_id: campaignId,
        });
        onCreated(newSkill);
        resetForm();
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || (isEditing ? "Unable to update skill" : "Unable to create skill"));
      } else {
        setFormError(isEditing ? "Unable to update skill" : "Unable to create skill");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSkill) return;
    setIsSaving(true);
    setFormError("");
    try {
      await deleteSkill(editingSkill.id);
      onDeleted?.(editingSkill.id);
      resetForm();
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

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <div className="space-y-3 border border-border/60 bg-background/80 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
            placeholder="Quick Hands"
          />
        </div>
        <div
          className="relative"
          onFocusCapture={() => setIsTypeMenuOpen(true)}
          onBlurCapture={handleTypeBlur}
        >
          <label className="mb-1 block text-xs text-muted-foreground">List</label>
          <ActionSearchInput
            value={form.type}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                type: event.target.value,
                typeCommitted: false,
              }))
            }
            placeholder="Search or add a list"
            actionLabel="Add list"
            actionAriaLabel="Add custom list"
            actionDisabled={!canAddType}
            onAction={handleAddType}
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Description</label>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            placeholder="Describe the skill."
            rows={2}
            className="min-h-[80px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
          />
        </div>
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? "Saving..." : isEditing ? "Save changes" : "Save"}
        </Button>
        <Button variant="secondary" onClick={handleCancel} disabled={isSaving} size="sm">
          Cancel
        </Button>
        {isEditing && (
          <Button
            variant="secondary"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isSaving}
            size="sm"
            className="ml-auto"
          >
            Delete
          </Button>
        )}
      </div>
      {isEditing && editingSkill && (
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          description={
            <span>
              Delete <span className="font-semibold text-foreground">{editingSkill.name}</span>?
              This action cannot be undone.
            </span>
          }
          confirmText={isSaving ? "Deleting..." : "Delete skill"}
          confirmDisabled={isSaving}
          isConfirming={isSaving}
          onConfirm={handleDelete}
          onCancel={() => setIsDeleteOpen(false)}
        />
      )}
    </div>
  );
}
