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
  subtype: string;
  cost: string;
  variable: string;
  singleUse: boolean;
  rarity: string;
  uniqueTo: string;
  description: string;
  strength: string;
  range: string;
  save: string;
  statblock: StatblockState;
};

const STAT_KEYS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
type StatKey = (typeof STAT_KEYS)[number];
type StatblockState = Record<StatKey, string>;

const createEmptyStatblock = (): StatblockState =>
  STAT_KEYS.reduce<StatblockState>(
    (acc, key) => ({ ...acc, [key]: "" }),
    {
      M: "",
      WS: "",
      BS: "",
      S: "",
      T: "",
      W: "",
      I: "",
      A: "",
      Ld: "",
    }
  );

const parseStatblock = (statblock?: string | null): StatblockState => {
  const empty = createEmptyStatblock();
  if (!statblock) {
    return empty;
  }

  try {
    const parsed = JSON.parse(statblock) as Record<string, string | number>;
    return STAT_KEYS.reduce(
      (acc, key) => ({
        ...acc,
        [key]: parsed?.[key] !== undefined ? String(parsed[key]) : "",
      }),
      empty
    );
  } catch {
    const entries = statblock.split(",").map((entry) => entry.trim());
    const next = { ...empty };
    entries.forEach((entry) => {
      const match = entry.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
      if (!match) {
        return;
      }
      const key = match[1].toUpperCase();
      const value = match[2].trim();
      if (STAT_KEYS.includes(key as StatKey)) {
        next[key as StatKey] = value;
      }
    });
    return next;
  }
};

const itemTypeOptions = ["Weapon", "Armour", "Animal", "Miscellaneous"];
const itemSubtypeOptions: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Animal: ["Mount", "Attack Animal"],
};

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
    subtype: item.subtype ?? "",
    cost: item.cost?.toString() ?? "",
    variable: item.variable ?? "",
    singleUse: item.single_use ?? false,
    rarity: item.rarity?.toString() ?? "",
    uniqueTo: item.unique_to ?? "",
    description: item.description ?? "",
    strength: item.strength ?? "",
    range: item.range ?? "",
    save: item.save ?? "",
    statblock: parseStatblock(item.statblock),
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
        subtype: item.subtype ?? "",
        cost: item.cost?.toString() ?? "",
        variable: item.variable ?? "",
        singleUse: item.single_use ?? false,
        rarity: item.rarity?.toString() ?? "",
        uniqueTo: item.unique_to ?? "",
        description: item.description ?? "",
        strength: item.strength ?? "",
        range: item.range ?? "",
        save: item.save ?? "",
        statblock: parseStatblock(item.statblock),
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
      const hasStatblockValues = STAT_KEYS.some((key) => form.statblock[key].trim());
      const updated = await updateItem(item.id, {
        name: form.name.trim(),
        type: form.type.trim(),
        subtype:
          form.type === "Weapon" || form.type === "Animal" ? form.subtype.trim() : "",
        cost: Number(form.cost),
        rarity: rarityValue,
        unique_to: form.uniqueTo.trim(),
        variable: form.variable.trim() || null,
        single_use: form.type === "Miscellaneous" ? form.singleUse : false,
        description: form.description.trim(),
        strength: form.strength.trim() || null,
        range: form.range.trim() || null,
        save: form.save.trim() || null,
        statblock:
          form.type === "Animal" && hasStatblockValues
            ? JSON.stringify(form.statblock)
            : null,
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
      <DialogContent className="max-w-3xl">
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
                  subtype: itemSubtypeOptions[value]?.[0] ?? "",
                  statblock: value === "Animal" ? prev.statblock : createEmptyStatblock(),
                  singleUse: value === "Miscellaneous" ? prev.singleUse : false,
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
          {form.type === "Weapon" || form.type === "Animal" ? (
            <div className="space-y-2">
              <Label htmlFor={`edit-item-subtype-${item.id}`}>Subtype</Label>
              <Select
                value={form.subtype}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    subtype: value,
                  }))
                }
              >
                <SelectTrigger id={`edit-item-subtype-${item.id}`}>
                  <SelectValue placeholder="Select a subtype" />
                </SelectTrigger>
                <SelectContent>
                  {(itemSubtypeOptions[form.type] ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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
          {form.type === "Weapon" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`edit-item-strength-${item.id}`}>Strength</Label>
                <Input
                  id={`edit-item-strength-${item.id}`}
                  value={form.strength}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      strength: event.target.value,
                    }))
                  }
                  placeholder="As user"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-item-range-${item.id}`}>Range</Label>
                <Input
                  id={`edit-item-range-${item.id}`}
                  value={form.range}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      range: event.target.value,
                    }))
                  }
                  placeholder="Close combat or 6/12"
                />
              </div>
            </div>
          ) : null}
          {form.type === "Armour" ? (
            <div className="space-y-2">
              <Label htmlFor={`edit-item-save-${item.id}`}>Save</Label>
              <Input
                id={`edit-item-save-${item.id}`}
                value={form.save}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    save: event.target.value,
                  }))
                }
                placeholder="6+"
              />
            </div>
          ) : null}
          {form.type === "Animal" ? (
            <div className="space-y-2">
              <Label>Statblock</Label>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-9">
                {STAT_KEYS.map((key) => (
                  <div key={key} className="space-y-1">
                    <Label
                      htmlFor={`edit-item-stat-${item.id}-${key}`}
                      className="text-xs uppercase tracking-[0.2em]"
                    >
                      {key}
                    </Label>
                    <Input
                      id={`edit-item-stat-${item.id}-${key}`}
                      value={form.statblock[key]}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          statblock: {
                            ...prev.statblock,
                            [key]: event.target.value,
                          },
                        }))
                      }
                      className="h-9 px-2 text-center text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
            <Label htmlFor={`edit-item-variable-${item.id}`}>Variable cost</Label>
            <Input
              id={`edit-item-variable-${item.id}`}
              value={form.variable}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  variable: event.target.value,
                }))
              }
              placeholder="+2d6"
            />
          </div>
          {form.type === "Miscellaneous" ? (
            <div className="flex items-center gap-2">
              <input
                id={`edit-item-single-use-${item.id}`}
                type="checkbox"
                checked={form.singleUse}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    singleUse: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border border-input/80 bg-background/60"
              />
              <Label htmlFor={`edit-item-single-use-${item.id}`}>Single use</Label>
            </div>
          ) : null}
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
