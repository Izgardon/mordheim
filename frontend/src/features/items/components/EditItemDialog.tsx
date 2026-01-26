import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// components
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";

// api
import { deleteItem, updateItem } from "../api/items-api";

// types
import type { Item } from "../types/item-types";

type EditItemDialogProps = {
  item: Item;
  onUpdated: (item: Item) => void;
  onDeleted: (itemId: number) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ItemFormState = {
  name: string;
  type: string;
  cost: string;
  rarity: string;
  uniqueTo: string;
  description: string;
};

const itemTypeOptions = [
  "Melee Weapon",
  "Ranged Weapon",
  "Armour",
  "Animal",
  "Miscellaneous",
  "Vehicle",
];

export default function EditItemDialog({
  item,
  onUpdated,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
}: EditItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<ItemFormState>({
    name: item.name ?? "",
    type: item.type ?? "",
    cost: item.cost?.toString() ?? "",
    rarity: item.rarity?.toString() ?? "",
    uniqueTo: item.unique_to ?? "",
    description: item.description ?? "",
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
      setForm({
        name: item.name ?? "",
        type: item.type ?? "",
        cost: item.cost?.toString() ?? "",
        rarity: item.rarity?.toString() ?? "",
        uniqueTo: item.unique_to ?? "",
        description: item.description ?? "",
      });
      setFormError("");
    }
  }, [item, resolvedOpen]);

  const resolvedTypeOptions = useMemo(() => {
    const currentType = item.type?.trim();
    if (currentType && !itemTypeOptions.includes(currentType)) {
      return [currentType, ...itemTypeOptions];
    }
    return itemTypeOptions;
  }, [item.type]);

  const handleOpenChange = (nextOpen: boolean) => {
    setResolvedOpen(nextOpen);
    if (!nextOpen) {
      setFormError("");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.type.trim() || !form.cost.trim() || !form.rarity.trim()) {
      setFormError("Name, type, price, and rarity are required.");
      return;
    }

    const rarityValue = Number(form.rarity);
    if (Number.isNaN(rarityValue) || rarityValue < 2 || rarityValue > 20) {
      setFormError("Rarity must be between 2 and 20.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const updated = await updateItem(item.id, {
        name: form.name.trim(),
        type: form.type.trim(),
        cost: Number(form.cost),
        rarity: rarityValue,
        unique_to: form.uniqueTo.trim(),
        description: form.description.trim(),
      });
      onUpdated(updated);
      setResolvedOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to update item");
      } else {
        setFormError("Unable to update item");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await deleteItem(item.id);
      onDeleted(item.id);
      setResolvedOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to delete item");
      } else {
        setFormError("Unable to delete item");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit wargear</DialogTitle>
          <DialogDescription>Adjust or remove this item from the campaign.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-item-name-${item.id}`}>Name</Label>
            <Input
              id={`edit-item-name-${item.id}`}
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Gutterblade"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-item-type-${item.id}`}>Type</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  type: value,
                }))
              }
            >
              <SelectTrigger id={`edit-item-type-${item.id}`}>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {resolvedTypeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-item-description-${item.id}`}>Description</Label>
            <textarea
              id={`edit-item-description-${item.id}`}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the item."
              className="min-h-[120px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-item-cost-${item.id}`}>Price</Label>
              <Input
                id={`edit-item-cost-${item.id}`}
                type="number"
                min={0}
                step={1}
                value={form.cost}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    cost: event.target.value,
                  }))
                }
                placeholder="25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-item-rarity-${item.id}`}>
                Rarity <span className="text-xs text-muted-foreground">(Common starts at 2)</span>
              </Label>
              <Input
                id={`edit-item-rarity-${item.id}`}
                type="number"
                min={2}
                max={20}
                step={1}
                value={form.rarity}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    rarity: event.target.value,
                  }))
                }
                placeholder="2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-item-unique-${item.id}`}>Restricted to</Label>
            <Input
              id={`edit-item-unique-${item.id}`}
              value={form.uniqueTo}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  uniqueTo: event.target.value,
                }))
              }
              placeholder="Skaven only"
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="destructive" type="button" onClick={handleDelete} disabled={isSaving}>
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

