import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// components
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { ConfirmDialog } from "@components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";

// api
import {
  createItem,
  createItemProperty,
  listItemProperties,
  updateItem,
  deleteItem,
} from "../api/items-api";

// types
import type { Item, ItemProperty } from "../types/item-types";

// icons
import { X } from "lucide-react";

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

type ItemFormDialogBaseProps = {
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ItemFormDialogCreateProps = ItemFormDialogBaseProps & {
  mode: "create";
  campaignId: number;
  onCreated: (item: Item) => void;
};

type ItemFormDialogEditProps = ItemFormDialogBaseProps & {
  mode: "edit";
  item: Item;
  campaignId: number;
  onUpdated: (item: Item) => void;
  onDeleted: (itemId: number) => void;
};

type ItemFormDialogProps = ItemFormDialogCreateProps | ItemFormDialogEditProps;

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

const buildFormFromItem = (item: Item): ItemFormState => ({
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

const mapPropertiesFromItem = (item: Item): ItemProperty[] =>
  (item.properties ?? []).map((property) => ({
    id: property.id,
    name: property.name,
    type: property.type,
    description: "",
  }));

export default function ItemFormDialog(props: ItemFormDialogProps) {
  const { trigger, open: openProp, onOpenChange } = props;
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [form, setForm] = useState<ItemFormState>(() =>
    props.mode === "edit" ? buildFormFromItem(props.item) : initialState
  );
  const [showFluff, setShowFluff] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<ItemProperty[]>(
    props.mode === "edit" ? mapPropertiesFromItem(props.item) : []
  );
  const [availableProperties, setAvailableProperties] = useState<ItemProperty[]>([]);
  const [propertySearch, setPropertySearch] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyDescription, setNewPropertyDescription] = useState("");
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const resolvedOpen = openProp ?? open;

  const resolvedTypeOptions = useMemo(() => {
    if (props.mode !== "edit") {
      return itemTypeOptions;
    }
    const currentType = props.item.type?.trim();
    if (currentType && !itemTypeOptions.includes(currentType)) {
      return [currentType, ...itemTypeOptions];
    }
    return itemTypeOptions;
  }, [props.mode, props.mode === "edit" ? props.item.type : ""]);

  const resetForm = () => {
    if (props.mode === "edit") {
      setForm(buildFormFromItem(props.item));
      setSelectedProperties(mapPropertiesFromItem(props.item));
    } else {
      setForm(initialState);
      setSelectedProperties([]);
    }
    setFormError("");
    setShowFluff(false);
    setPropertySearch("");
    setShowPropertyForm(false);
    setNewPropertyName("");
    setNewPropertyDescription("");
  };

  useEffect(() => {
    if (props.mode === "edit" && resolvedOpen) {
      setForm(buildFormFromItem(props.item));
      setSelectedProperties(mapPropertiesFromItem(props.item));
      setFormError("");
    }
  }, [props.mode, props.mode === "edit" ? props.item : null, resolvedOpen]);

  useEffect(() => {
    if (form.type && resolvedOpen) {
      listItemProperties({
        type: form.type,
        search: propertySearch,
        campaignId: props.campaignId,
      })
        .then((properties) => setAvailableProperties(properties))
        .catch(() => setAvailableProperties([]));
    } else {
      setAvailableProperties([]);
    }
  }, [form.type, propertySearch, props.campaignId, resolvedOpen]);

  useEffect(() => {
    setSelectedProperties((prev) =>
      prev.map((property) =>
        availableProperties.find((p) => p.id === property.id) ?? property
      )
    );
  }, [availableProperties]);

  useEffect(() => {
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
        campaign_id: props.campaignId,
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

  const buildPayload = () => {
    const hasStatblockValues = STAT_KEYS.some((key) => form.statblock[key].trim());
    const rarityValue = Number(form.rarity);
    return {
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
    };
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
      if (props.mode === "create") {
        if (Number.isNaN(props.campaignId)) {
          setFormError("Unable to create item.");
          return;
        }
        const newItem = await createItem({
          ...buildPayload(),
          campaign_id: props.campaignId,
        });
        props.onCreated(newItem);
      } else {
        const updated = await updateItem(props.item.id, buildPayload());
        props.onUpdated(updated);
      }
      setResolvedOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to save item");
      } else {
        setFormError("Unable to save item");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (props.mode !== "edit") {
      return;
    }
    setIsSaving(true);
    setFormError("");

    try {
      await deleteItem(props.item.id);
      props.onDeleted(props.item.id);
      setResolvedOpen(false);
      setIsDeleteOpen(false);
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

  const triggerNode = trigger === undefined
    ? props.mode === "create"
      ? <Button>Add item</Button>
      : (
        <Button variant="outline" size="sm">
          Edit
        </Button>
      )
    : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>
            {props.mode === "create" ? "ADD WARGEAR" : "EDIT WARGEAR"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`item-name-${props.mode}`}>Name</Label>
            <Input
              id={`item-name-${props.mode}`}
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
            <Label htmlFor={`item-type-${props.mode}`}>Type</Label>
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
              <SelectTrigger id={`item-type-${props.mode}`}>
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
          {form.type === "Weapon" || form.type === "Armour" || form.type === "Animal" ? (
            <div className="space-y-2">
              <Label htmlFor={`item-subtype-${props.mode}`}>Subtype</Label>
              <Select
                value={form.subtype}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    subtype: value,
                  }))
                }
              >
                <SelectTrigger id={`item-subtype-${props.mode}`}>
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
              >
                <ActionSearchDropdown
                  open={propertySearch.length > 0 && availableProperties.length > 0}
                  onClose={() => setPropertySearch("")}
                  className="rounded-lg border-input/80"
                >
                  <div className="max-h-40 overflow-y-auto">
                    {availableProperties
                      .filter((prop) => !selectedProperties.find((sp) => sp.id === prop.id))
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
                </ActionSearchDropdown>
              </ActionSearchInput>
              {showPropertyForm ? (
                <div className="space-y-3 rounded-lg border border-input/80 bg-background/40 p-4">
                  <div className="space-y-2">
                    <Label htmlFor={`new-property-name-${props.mode}`}>Property name</Label>
                    <Input
                      id={`new-property-name-${props.mode}`}
                      value={newPropertyName}
                      onChange={(e) => setNewPropertyName(e.target.value)}
                      placeholder="Battle Schooled"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`new-property-description-${props.mode}`}>Description</Label>
                    <textarea
                      id={`new-property-description-${props.mode}`}
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
            <Checkbox
              id={`add-fluff-toggle-${props.mode}`}
              checked={showFluff}
              onChange={(e) => setShowFluff(e.target.checked)}
            />
            <Label htmlFor={`add-fluff-toggle-${props.mode}`}>Add fluff</Label>
          </div>
          {showFluff ? (
            <textarea
              id={`item-description-${props.mode}`}
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
                <Label htmlFor={`item-strength-${props.mode}`}>Strength</Label>
                <Input
                  id={`item-strength-${props.mode}`}
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
                <Label htmlFor={`item-range-${props.mode}`}>Range</Label>
                <Input
                  id={`item-range-${props.mode}`}
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
              <Label htmlFor={`item-save-${props.mode}`}>Save</Label>
              <Input
                id={`item-save-${props.mode}`}
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
                    <Label htmlFor={`item-stat-${props.mode}-${key}`} className="text-xs uppercase tracking-[0.2em]">
                      {key}
                    </Label>
                    <Input
                      id={`item-stat-${props.mode}-${key}`}
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
              <Label htmlFor={`item-cost-${props.mode}`}>Price</Label>
                <NumberInput
                  id={`item-cost-${props.mode}`}
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
              <Label htmlFor={`item-rarity-${props.mode}`}>
                Rarity <span className="text-xs text-muted-foreground">(Common starts at 2)</span>
              </Label>
                <NumberInput
                  id={`item-rarity-${props.mode}`}
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
            <Label htmlFor={`item-variable-${props.mode}`}>Variable cost</Label>
            <Input
              id={`item-variable-${props.mode}`}
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
              <Checkbox
                id={`item-single-use-${props.mode}`}
                checked={form.singleUse}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    singleUse: event.target.checked,
                  }))
                }
              />
              <Label htmlFor={`item-single-use-${props.mode}`}>Single use</Label>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`item-unique-${props.mode}`}>Restricted to</Label>
            <Input
              id={`item-unique-${props.mode}`}
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
        <DialogFooter className={props.mode === "edit" ? "flex flex-wrap items-center justify-between gap-3" : undefined}>
          {props.mode === "edit" ? (
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
            {isSaving ? "Saving..." : props.mode === "create" ? "Add item" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {props.mode === "edit" ? (
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          description={
            <span>
              Delete <span className="font-semibold text-foreground">{props.item.name}</span>?
              This action cannot be undone.
            </span>
          }
          confirmText={isSaving ? "Deleting..." : "Delete item"}
          confirmDisabled={isSaving}
          isConfirming={isSaving}
          onConfirm={handleDelete}
          onCancel={() => setIsDeleteOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}
