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
import { Tooltip } from "@components/tooltip";

// api
import {
  createItem,
  createItemProperty,
  createRestriction,
  listItemProperties,
  listRestrictions,
  updateItem,
  deleteItem,
} from "../api/items-api";

// types
import type { Item, ItemProperty, Restriction } from "../types/item-types";

// icons
import { X } from "lucide-react";

// assets
import editIcon from "@/assets/components/edit.webp";

type AvailabilityRestrictionRow = {
  restrictionId: number;
  restrictionLabel: string;
  additionalNote: string;
};

type AvailabilityRow = {
  cost: string;
  rarity: string;
  variableCost: string;
  restrictions: AvailabilityRestrictionRow[];
};

const emptyAvailabilityRow = (): AvailabilityRow => ({
  cost: "",
  rarity: "",
  variableCost: "",
  restrictions: [],
});

const restrictionLabel = (r: Restriction) => `${r.restriction} (${r.type})`;

const RESTRICTION_TYPE_OPTIONS = ["Warband", "Warband Group", "Setting", "Artifact"];

type ItemFormState = {
  name: string;
  type: string;
  subtype: string;
  singleUse: boolean;
  description: string;
  strength: string;
  range: string;
  save: string;
  statblock: StatblockState;
  availabilities: AvailabilityRow[];
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
  singleUse: false,
  description: "",
  strength: "",
  range: "",
  save: "",
  statblock: createEmptyStatblock(),
  availabilities: [emptyAvailabilityRow()],
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
  singleUse: item.single_use ?? false,
  description: item.description ?? "",
  strength: item.strength ?? "",
  range: item.range ?? "",
  save: item.save ?? "",
  statblock: parseStatblock(item.statblock),
  availabilities:
    item.availabilities?.length > 0
      ? item.availabilities.map((a) => ({
          cost: a.cost?.toString() ?? "",
          rarity: a.rarity?.toString() ?? "",
          variableCost: a.variable_cost ?? "",
          restrictions: (a.restrictions ?? []).map((link) => ({
            restrictionId: link.restriction.id,
            restrictionLabel: restrictionLabel(link.restriction),
            additionalNote: link.additional_note ?? "",
          })),
        }))
      : [emptyAvailabilityRow()],
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
  const [allRestrictions, setAllRestrictions] = useState<Restriction[]>([]);
  const [restrictionSearches, setRestrictionSearches] = useState<Record<number, string>>({});
  const [showRestrictionForm, setShowRestrictionForm] = useState<Record<number, boolean>>({});
  const [newRestrictionName, setNewRestrictionName] = useState("");
  const [newRestrictionType, setNewRestrictionType] = useState("Warband");
  const [isCreatingRestriction, setIsCreatingRestriction] = useState(false);
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

  useEffect(() => {
    if (resolvedOpen) {
      listRestrictions({ campaignId: props.campaignId })
        .then(setAllRestrictions)
        .catch(() => setAllRestrictions([]));
    }
  }, [resolvedOpen, props.campaignId]);

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
    setRestrictionSearches({});
    setShowRestrictionForm({});
    setNewRestrictionName("");
    setNewRestrictionType("Warband");
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

  const addRestrictionToAvailability = (index: number, restriction: Restriction) => {
    setForm((prev) => ({
      ...prev,
      availabilities: prev.availabilities.map((row, i) => {
        if (i !== index) return row;
        if (row.restrictions.some((r) => r.restrictionId === restriction.id)) return row;
        return {
          ...row,
          restrictions: [
            ...row.restrictions,
            {
              restrictionId: restriction.id,
              restrictionLabel: restrictionLabel(restriction),
              additionalNote: "",
            },
          ],
        };
      }),
    }));
    setRestrictionSearches((prev) => ({ ...prev, [index]: "" }));
  };

  const removeRestrictionFromAvailability = (availIndex: number, restrictionId: number) => {
    setForm((prev) => ({
      ...prev,
      availabilities: prev.availabilities.map((row, i) =>
        i === availIndex
          ? { ...row, restrictions: row.restrictions.filter((r) => r.restrictionId !== restrictionId) }
          : row
      ),
    }));
  };

  const updateRestrictionNote = (availIndex: number, restrictionId: number, note: string) => {
    setForm((prev) => ({
      ...prev,
      availabilities: prev.availabilities.map((row, i) =>
        i === availIndex
          ? {
              ...row,
              restrictions: row.restrictions.map((r) =>
                r.restrictionId === restrictionId ? { ...r, additionalNote: note } : r
              ),
            }
          : row
      ),
    }));
  };

  const handleCreateRestriction = async (availIndex: number) => {
    if (!newRestrictionName.trim()) return;
    setIsCreatingRestriction(true);
    try {
      const created = await createRestriction({
        type: newRestrictionType,
        restriction: newRestrictionName.trim(),
      });
      setAllRestrictions((prev) => [...prev, created]);
      addRestrictionToAvailability(availIndex, created);
      setNewRestrictionName("");
      setNewRestrictionType("Warband");
      setShowRestrictionForm({});
    } catch (error) {
      console.error("Failed to create restriction:", error);
    } finally {
      setIsCreatingRestriction(false);
    }
  };

  const buildPayload = () => {
    const hasStatblockValues = STAT_KEYS.some((key) => form.statblock[key].trim());
    return {
      name: form.name.trim(),
      type: form.type.trim(),
      subtype:
        form.type === "Weapon" || form.type === "Armour" || form.type === "Animal"
          ? form.subtype.trim()
          : "",
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
      availabilities: form.availabilities.map((row) => ({
        cost: Number(row.cost),
        rarity: Number(row.rarity),
        variable_cost: row.variableCost.trim() || null,
        restrictions: row.restrictions.map((r) => ({
          restriction_id: r.restrictionId,
          additional_note: r.additionalNote,
        })),
      })),
    };
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.type.trim()) {
      setFormError("Name and type are required.");
      return;
    }

    if (form.availabilities.length === 0) {
      setFormError("At least one availability is required.");
      return;
    }

    for (let i = 0; i < form.availabilities.length; i++) {
      const row = form.availabilities[i];
      if (!row.cost.trim() || !row.rarity.trim()) {
        setFormError(`Availability ${i + 1}: price and rarity are required.`);
        return;
      }
      const rarityValue = Number(row.rarity);
      if (Number.isNaN(rarityValue) || rarityValue < 2 || rarityValue > 20) {
        setFormError(`Availability ${i + 1}: rarity must be between 2 and 20.`);
        return;
      }
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
        <Tooltip
          trigger={
            <button type="button" aria-label="Edit item" className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125">
              <img src={editIcon} alt="" className="h-full w-full object-contain" />
            </button>
          }
          content="Edit"
        />
      )
    : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>
            {props.mode === "create" ? "Add Wargear" : "Edit Wargear"}
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
                      className="min-h-[80px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
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
              className="min-h-[120px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Availabilities</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    availabilities: [...prev.availabilities, emptyAvailabilityRow()],
                  }))
                }
              >
                Add
              </Button>
            </div>
            {form.availabilities.map((row, index) => {
              const rSearch = restrictionSearches[index] ?? "";
              const filteredRestrictions = rSearch.length > 0
                ? allRestrictions.filter(
                    (r) =>
                      r.restriction.toLowerCase().includes(rSearch.toLowerCase()) &&
                      !row.restrictions.some((sel) => sel.restrictionId === r.id)
                  )
                : [];
              return (
                <div key={index} className="space-y-3 rounded-lg border border-input/80 bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      {form.availabilities.length > 1 ? `Availability ${index + 1}` : "Availability"}
                    </span>
                    {form.availabilities.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            availabilities: prev.availabilities.filter((_, i) => i !== index),
                          }))
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`item-cost-${props.mode}-${index}`}>Price</Label>
                      <NumberInput
                        id={`item-cost-${props.mode}-${index}`}
                        min={0}
                        step={1}
                        value={row.cost}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            availabilities: prev.availabilities.map((r, i) =>
                              i === index ? { ...r, cost: event.target.value } : r
                            ),
                          }))
                        }
                        placeholder="25"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`item-rarity-${props.mode}-${index}`}>
                        Rarity <span className="text-xs text-muted-foreground">(Common = 2)</span>
                      </Label>
                      <NumberInput
                        id={`item-rarity-${props.mode}-${index}`}
                        min={2}
                        max={20}
                        step={1}
                        value={row.rarity}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            availabilities: prev.availabilities.map((r, i) =>
                              i === index ? { ...r, rarity: event.target.value } : r
                            ),
                          }))
                        }
                        placeholder="2"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item-variable-${props.mode}-${index}`}>Variable cost</Label>
                    <Input
                      id={`item-variable-${props.mode}-${index}`}
                      value={row.variableCost}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          availabilities: prev.availabilities.map((r, i) =>
                            i === index ? { ...r, variableCost: event.target.value } : r
                          ),
                        }))
                      }
                      placeholder="+2d6"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Restrictions</Label>
                    <ActionSearchInput
                      placeholder="Search restrictions..."
                      value={rSearch}
                      onChange={(e) =>
                        setRestrictionSearches((prev) => ({ ...prev, [index]: e.target.value }))
                      }
                      onAction={() =>
                        setShowRestrictionForm((prev) => ({ ...prev, [index]: !prev[index] }))
                      }
                      actionLabel="Create"
                    >
                      <ActionSearchDropdown
                        open={filteredRestrictions.length > 0}
                        onClose={() =>
                          setRestrictionSearches((prev) => ({ ...prev, [index]: "" }))
                        }
                        className="rounded-lg border-input/80"
                      >
                        <div className="max-h-40 overflow-y-auto">
                          {filteredRestrictions.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => addRestrictionToAvailability(index, r)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent/50"
                            >
                              {r.restriction}{" "}
                              <span className="text-xs text-muted-foreground">({r.type})</span>
                            </button>
                          ))}
                        </div>
                      </ActionSearchDropdown>
                    </ActionSearchInput>
                    {showRestrictionForm[index] && (
                      <div className="space-y-2 rounded-lg border border-input/80 bg-background/40 p-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor={`restriction-type-${props.mode}-${index}`}>Type</Label>
                            <Select value={newRestrictionType} onValueChange={setNewRestrictionType}>
                              <SelectTrigger id={`restriction-type-${props.mode}-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RESTRICTION_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-2 space-y-1">
                            <Label htmlFor={`restriction-name-${props.mode}-${index}`}>Name</Label>
                            <Input
                              id={`restriction-name-${props.mode}-${index}`}
                              value={newRestrictionName}
                              onChange={(e) => setNewRestrictionName(e.target.value)}
                              placeholder="Skaven"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={() => handleCreateRestriction(index)}
                          disabled={isCreatingRestriction || !newRestrictionName.trim()}
                          size="sm"
                        >
                          {isCreatingRestriction ? "Creating..." : "Add restriction"}
                        </Button>
                      </div>
                    )}
                    {row.restrictions.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {row.restrictions.map((r) => (
                          <div
                            key={r.restrictionId}
                            className="flex items-center gap-2"
                          >
                            <div className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm">
                              <span>{r.restrictionLabel}</span>
                              <button
                                type="button"
                                onClick={() => removeRestrictionFromAvailability(index, r.restrictionId)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <Input
                              value={r.additionalNote}
                              onChange={(e) =>
                                updateRestrictionNote(index, r.restrictionId, e.target.value)
                              }
                              placeholder="Note (optional)"
                              className="h-7 max-w-48 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
