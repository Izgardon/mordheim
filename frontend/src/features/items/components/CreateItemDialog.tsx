import { useState } from "react";

// components
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

// api
import { createItem } from "../api/items-api";

// types
import type { Item } from "../types/item-types";

type CreateItemDialogProps = {
  campaignId: number;
  onCreated: (item: Item) => void;
};

type ItemFormState = {
  name: string;
  type: string;
  cost: string;
  availability: string;
  uniqueTo: string;
  custom: boolean;
};

const initialState: ItemFormState = {
  name: "",
  type: "",
  cost: "",
  availability: "",
  uniqueTo: "",
  custom: true,
};

export default function CreateItemDialog({ campaignId, onCreated }: CreateItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<ItemFormState>(initialState);

  const resetForm = () => {
    setForm(initialState);
    setFormError("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleCreate = async () => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create item.");
      return;
    }

    if (!form.name.trim() || !form.type.trim() || !form.cost.trim()) {
      setFormError("Name, type, and cost are required.");
      return;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const newItem = await createItem({
        name: form.name.trim(),
        type: form.type.trim(),
        cost: form.cost.trim(),
        availability: form.availability.trim(),
        unique_to: form.uniqueTo.trim(),
        custom: form.custom,
        campaign_id: campaignId,
      });
      onCreated(newItem);
      setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add gear</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add wargear</DialogTitle>
          <DialogDescription>Record custom gear for this campaign.</DialogDescription>
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
            <Input
              id="item-type"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value,
                }))
              }
              placeholder="Weapon"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item-cost">Cost</Label>
              <Input
                id="item-cost"
                value={form.cost}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    cost: event.target.value,
                  }))
                }
                placeholder="25 gc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-availability">Availability</Label>
              <Input
                id="item-availability"
                value={form.availability}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    availability: event.target.value,
                  }))
                }
                placeholder="Rare 9"
              />
            </div>
          </div>
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.custom}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  custom: event.target.checked,
                }))
              }
            />
            Custom entry
          </label>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Saving..." : "Add gear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




