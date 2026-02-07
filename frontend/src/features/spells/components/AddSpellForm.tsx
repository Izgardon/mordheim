import { useMemo, useState } from "react";
import type { FocusEvent } from "react";

import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { Button } from "@components/button";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";

import { createSpell } from "../api/spells-api";

import type { Spell } from "../types/spell-types";

type AddSpellFormProps = {
  campaignId: number;
  onCreated: (spell: Spell) => void;
  onCancel: () => void;
  typeOptions?: string[];
};

type SpellFormState = {
  name: string;
  type: string;
  description: string;
  dc: string;
  roll: string;
  typeCommitted: boolean;
};

const initialState: SpellFormState = {
  name: "",
  type: "",
  description: "",
  dc: "",
  roll: "",
  typeCommitted: false,
};

const ROLL_OPTIONS = ["1", "2", "3", "4", "5", "6"] as const;

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

export default function AddSpellForm({
  campaignId,
  onCreated,
  onCancel,
  typeOptions = [],
}: AddSpellFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<SpellFormState>(initialState);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);

  const resetForm = () => {
    setForm(initialState);
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

  const handleCreate = async () => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create spell.");
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

    const trimmedDc = form.dc.trim();
    const dcValue = trimmedDc ? Number(trimmedDc) : null;
    if (trimmedDc && Number.isNaN(dcValue)) {
      setFormError("Difficulty must be a number.");
      return;
    }

    const rollValue = form.roll ? Number(form.roll) : null;

    setIsCreating(true);
    setFormError("");

    try {
      const newSpell = await createSpell({
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
        dc: dcValue,
        roll: rollValue,
        campaign_id: campaignId,
      });
      onCreated(newSpell);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to create spell");
      } else {
        setFormError("Unable to create spell");
      }
    } finally {
      setIsCreating(false);
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
            placeholder="Fireball"
          />
        </div>
        <div
          className="relative"
          onFocusCapture={() => setIsTypeMenuOpen(true)}
          onBlurCapture={handleTypeBlur}
        >
          <label className="mb-1 block text-xs text-muted-foreground">Type</label>
          <ActionSearchInput
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
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Difficulty</label>
          <NumberInput
            min={0}
            value={form.dc}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                dc: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Roll</label>
          <Select
            value={form.roll}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                roll: value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select roll" />
            </SelectTrigger>
            <SelectContent>
              {ROLL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Description</label>
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              description: event.target.value,
            }))
          }
          placeholder="Describe the spell."
          rows={2}
          className="min-h-[80px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
        />
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2">
        <Button onClick={handleCreate} disabled={isCreating} size="sm">
          {isCreating ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={handleCancel} disabled={isCreating} size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
