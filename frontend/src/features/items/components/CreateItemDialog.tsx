import { useEffect, useState } from "react";
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
import { ActionSearchInput } from "@components/action-search-input";

// api
import { createItem, createItemProperty, listItemProperties } from "../api/items-api";

// types
import type { Item, ItemProperty } from "../types/item-types";

// icons
import { X } from "lucide-react";

type CreateItemDialogProps = {
  campaignId: number;
  onCreated: (item: Item) => void;
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

const initialState: ItemFormState = {
  name: "",
  type: "",
  subtype: "",
  cost: "",
  variable: "",
  singleUse: false,
  rarity: "",
  uniqueTo: "",
  description: "",
  strength: "",
  range: "",
  save: "",
  statblock: createEmptyStatblock(),
};

const itemTypeOptions = ["Weapon", "Armour", "Animal", "Miscellaneous"];
const itemSubtypeOptions: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Attack"],
};

export default function CreateItemDialog({
  campaignId,
  onCreated,
  trigger,
  open: openProp,
  onOpenChange,
}: CreateItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<ItemFormState>(initialState);
  const [showFluff, setShowFluff] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<ItemProperty[]>([]);
  const [availableProperties, setAvailableProperties] = useState<ItemProperty[]>([]);
  const [propertySearch, setPropertySearch] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyDescription, setNewPropertyDescription] = useState("");
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const resolvedOpen = openProp ?? open;

  const resetForm = () => {
    setForm(initialState);
    setFormError("");
    setShowFluff(false);
    setSelectedProperties([]);
    setPropertySearch("");
    setShowPropertyForm(false);
    setNewPropertyName("");
    setNewPropertyDescription("");
  };

  useEffect(() => {
    if (form.type && resolvedOpen) {
      listItemProperties({ type: form.type, search: propertySearch, campaignId })
        .then((properties) => setAvailableProperties(properties))
        .catch(() => setAvailableProperties([]));
    } else {
      setAvailableProperties([]);
    }
  }, [form.type, propertySearch, campaignId, resolvedOpen]);

  useEffect(() => {
    setSelectedProperties([]);
    setPropertySearch("");
    setShowPropertyForm(false);
  }, [form.type]);

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

  const handleSelectProperty = (property: ItemProperty) => {
    if (!selectedProperties.find((p) => p.id === property.id)) {
      setSelectedProperties([...selectedProperties, property]);
      setPropertySearch("");
    }
  };

  const handleRemoveProperty = (propertyId: number) => {
    setSelectedProperties(selectedProperties.filter((p) => p.id !== propertyId));
  };

  const handleCreateProperty = async () => {
    if (!newPropertyName.trim() || !form.type) {
      return;
    }

    setIsCreatingProperty(true);
    try {
      const newProperty = await createItemProperty({
        name: newPropertyName.trim(),
        description: newPropertyDescription.trim(),
        type: form.type,
        campaign_id: campaignId,
      });
      setSelectedProperties([...selectedProperties, newProperty]);
      setAvailableProperties([...availableProperties, newProperty]);
      setNewPropertyName("");
      setNewPropertyDescription("");
      setPropertySearch("");
    } catch (error) {
      console.error("Failed to create property:", error);
    } finally {
      setIsCreatingProperty(false);
    }
  };

  const handleCreate = async () => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create item.");
      return;
    }

    if (!form.name.trim() || !form.type.trim() || !form.cost.trim() || !form.rarity.trim()) {
      setFormError("Name, type, price, and rarity are required.");
      return;
    }

    const rarityValue = Number(form.rarity);
    if (Number.isNaN(rarityValue) || rarityValue < 2 || rarityValue > 20) {
      setFormError("Rarity must be between 2 and 20.");
      return;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const hasStatblockValues = STAT_KEYS.some((key) => form.statblock[key].trim());
      const newItem = await createItem({
        name: form.name.trim(),
        type: form.type.trim(),
        subtype:
          form.type === "Weapon" || form.type === "Armour" || form.type === "Animal"
            ? form.subtype.trim()
            : "",
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
        property_ids: selectedProperties.map((p) => p.id),
        campaign_id: campaignId,
      });
      onCreated(newItem);
      setResolvedOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to create item");
      } else {
        setFormError("Unable to create item");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const triggerNode = trigger === undefined ? <Button>Add item</Button> : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add wargear</DialogTitle>
          <DialogDescription>Record gear for this campaign.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
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
            <Label htmlFor="item-type">Type</Label>
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
              <SelectTrigger id="item-type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {itemTypeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.type === "Weapon" || form.type === "Armour" || form.type === "Animal" ? (
            <div className="space-y-2">
              <Label htmlFor="item-subtype">Subtype</Label>
              <Select
                value={form.subtype}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    subtype: value,
                  }))
                }
              >
                <SelectTrigger id="item-subtype">
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
          {form.type ? (
            <div className="space-y-3">
              <Label>Properties</Label>
              <ActionSearchInput
                placeholder="Search properties..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                onAction={() => setShowPropertyForm(!showPropertyForm)}
                actionLabel="Create"
              />
              {showPropertyForm ? (
                <div className="space-y-3 rounded-lg border border-input/80 bg-background/40 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-property-name">Property name</Label>
                    <Input
                      id="new-property-name"
                      value={newPropertyName}
                      onChange={(e) => setNewPropertyName(e.target.value)}
                      placeholder="Battle Schooled"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-property-description">Description</Label>
                    <textarea
                      id="new-property-description"
                      value={newPropertyDescription}
                      onChange={(e) => setNewPropertyDescription(e.target.value)}
                      placeholder="Describe this property..."
                      className="min-h-[80px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    />
                  </div>
                  <Button
                    onClick={handleCreateProperty}
                    disabled={isCreatingProperty || !newPropertyName.trim()}
                    size="sm"
                  >
                    {isCreatingProperty ? "Creating..." : "Add property"}
                  </Button>
                </div>
              ) : null}
              {propertySearch && availableProperties.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-input/80 bg-background/40">
                  {availableProperties
                    .filter(
                      (prop) => !selectedProperties.find((sp) => sp.id === prop.id)
                    )
                    .map((property) => (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => handleSelectProperty(property)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent/50"
                        title={property.description}
                      >
                        {property.name}
                      </button>
                    ))}
                </div>
              ) : null}
              {selectedProperties.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedProperties.map((property) => (
                    <div
                      key={property.id}
                      className="group relative inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm"
                      title={property.description}
                    >
                      <span>{property.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProperty(property.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              id="add-fluff-toggle"
              type="checkbox"
              checked={showFluff}
              onChange={(e) => setShowFluff(e.target.checked)}
              className="h-4 w-4 rounded border border-input/80 bg-background/60"
            />
            <Label htmlFor="add-fluff-toggle">Add fluff</Label>
          </div>
          {showFluff ? (
            <textarea
              id="item-description"
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
          ) : null}
          {form.type === "Weapon" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-strength">Strength</Label>
                <Input
                  id="item-strength"
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
                <Label htmlFor="item-range">Range</Label>
                <Input
                  id="item-range"
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
              <Label htmlFor="item-save">Save</Label>
              <Input
                id="item-save"
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
                    <Label htmlFor={`item-stat-${key}`} className="text-xs uppercase tracking-[0.2em]">
                      {key}
                    </Label>
                    <Input
                      id={`item-stat-${key}`}
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
              <Label htmlFor="item-cost">Price</Label>
              <Input
                id="item-cost"
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
              <Label htmlFor="item-rarity">
                Rarity <span className="text-xs text-muted-foreground">(Common starts at 2)</span>
              </Label>
              <Input
                id="item-rarity"
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
            <Label htmlFor="item-variable">Variable cost</Label>
            <Input
              id="item-variable"
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
                id="item-single-use"
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
              <Label htmlFor="item-single-use">Single use</Label>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="item-unique">Restricted to</Label>
            <Input
              id="item-unique"
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
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Saving..." : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
