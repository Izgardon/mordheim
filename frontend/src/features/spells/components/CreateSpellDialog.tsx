import { useMemo, useState } from "react";
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
import { NumberInput } from "@components/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";

// api
import { createSpell } from "../api/spells-api";

// types
import type { Spell } from "../types/spell-types";

type CreateSpellDialogProps = {
  campaignId: number;
  onCreated: (spell: Spell) => void;
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export default function CreateSpellDialog({
  campaignId,
  onCreated,
  typeOptions = [],
  trigger,
  open: openProp,
  onOpenChange,
}: CreateSpellDialogProps) {
  const [open, setOpen] = useState(false);
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
      setResolvedOpen(false);
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

  const triggerNode = trigger === undefined ? <Button>Add spell</Button> : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: "#a78f79" }}>
            Add Spell
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spell-name">Name</Label>
            <Input
              id="spell-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Fireball"
              required
            />
          </div>
          <div
            className="relative space-y-2"
            onFocusCapture={() => setIsTypeMenuOpen(true)}
            onBlurCapture={handleTypeBlur}
          >
            <Label htmlFor="spell-type">Class</Label>
            <ActionSearchInput
              id="spell-type"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value,
                  typeCommitted: false,
                }))
              }
              placeholder="Search or add a class"
              actionLabel="Add class"
              actionAriaLabel="Add custom class"
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spell-dc">Difficulty</Label>
              <NumberInput
                id="spell-dc"
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
            <div className="space-y-2">
              <Label htmlFor="spell-roll">Roll</Label>
              <Select
                value={form.roll}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    roll: value,
                  }))
                }
              >
                <SelectTrigger id="spell-roll">
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
          <div className="space-y-2">
            <Label htmlFor="spell-description">Description</Label>
            <textarea
              id="spell-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the spell."
              className="min-h-[120px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
              required
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Saving..." : "Add spell"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
