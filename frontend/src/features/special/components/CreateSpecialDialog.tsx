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

// api
import { createSpecial } from "../api/special-api";

// types
import type { Special } from "../types/special-types";

type CreateSpecialDialogProps = {
  campaignId: number;
  onCreated: (special: Special) => void;
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SpecialFormState = {
  name: string;
  type: string;
  description: string;
  typeCommitted: boolean;
};

const initialState: SpecialFormState = {
  name: "",
  type: "",
  description: "",
  typeCommitted: false,
};

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

export default function CreateSpecialDialog({
  campaignId,
  onCreated,
  typeOptions = [],
  trigger,
  open: openProp,
  onOpenChange,
}: CreateSpecialDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<SpecialFormState>(initialState);

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
      setFormError("Unable to create entry.");
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
      const newSpecial = await createSpecial({
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
        campaign_id: campaignId,
      });
      onCreated(newSpecial);
      setResolvedOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to create entry");
      } else {
        setFormError("Unable to create entry");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const triggerNode = trigger === undefined ? <Button>Add special</Button> : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: "#a78f79" }}>
            ADD AN ENTRY
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="special-name">Name</Label>
            <Input
              id="special-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Blessing"
              required
            />
          </div>
          <div
            className="relative space-y-2"
            onFocusCapture={() => setIsTypeMenuOpen(true)}
            onBlurCapture={handleTypeBlur}
          >
            <Label htmlFor="special-type">Category (Injury, Mutation etc)</Label>
            <ActionSearchInput
              id="special-type"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value,
                  typeCommitted: false,
                }))
              }
              placeholder="Search or add a special"
              actionLabel="Add category"
              actionAriaLabel="Add custom category"
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
            <Label htmlFor="special-description">Description</Label>
            <textarea
              id="special-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the entry."
              className="min-h-[120px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
              required
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Saving..." : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
