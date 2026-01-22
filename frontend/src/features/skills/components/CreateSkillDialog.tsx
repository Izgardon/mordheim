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
import { createSkill } from "../api/skills-api";

// types
import type { Skill } from "../types/skill-types";

type CreateSkillDialogProps = {
  campaignId: number;
  onCreated: (skill: Skill) => void;
};

type SkillFormState = {
  name: string;
  type: string;
  description: string;
  custom: boolean;
};

const initialState: SkillFormState = {
  name: "",
  type: "",
  description: "",
  custom: true,
};

export default function CreateSkillDialog({ campaignId, onCreated }: CreateSkillDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<SkillFormState>(initialState);

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
      setFormError("Unable to create skill.");
      return;
    }

    if (!form.name.trim() || !form.type.trim()) {
      setFormError("Name and type are required.");
      return;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const newSkill = await createSkill({
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
        custom: form.custom,
        campaign_id: campaignId,
      });
      onCreated(newSkill);
      setOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to create skill");
      } else {
        setFormError("Unable to create skill");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add skill</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a skill</DialogTitle>
          <DialogDescription>Record a custom technique for this campaign.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
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
          <div className="space-y-2">
            <Label htmlFor="skill-type">Type</Label>
            <Input
              id="skill-type"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value,
                }))
              }
              placeholder="Combat"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-description">Description</Label>
            <textarea
              id="skill-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the effect."
              className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            {isCreating ? "Saving..." : "Add skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




