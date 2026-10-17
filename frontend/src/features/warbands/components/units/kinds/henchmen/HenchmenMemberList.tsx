import { useState } from "react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { Input } from "@components/input";
import DismissUnitDescription from "../../DismissUnitDescription";
import AddHenchmanDialog, {
  type AddHenchmanResult,
} from "../../../henchmen/dialogs/AddHenchmanDialog";

import type { UnitFormSlotProps } from "../../forms/form-types";

type HenchmenMemberListProps = Pick<
  UnitFormSlotProps<"henchmen_group">,
  "form" | "index" | "inputClassName" | "onUpdate" | "onRemove" | "hasFieldError"
> & {
  stashQtyById: Record<number, number>;
};

/**
 * The group's roster tab: rename members, add one (a saved group asks for his cost and items in
 * the add-henchman dialog) and remove one (removing the last disbands the group).
 */
export default function HenchmenMemberList({
  form: group,
  index,
  inputClassName,
  onUpdate,
  onRemove,
  hasFieldError,
  stashQtyById,
}: HenchmenMemberListProps) {
  const [henchmanToRemove, setHenchmanToRemove] = useState<number | null>(null);
  const maxSize = Number(group.max_size) || 0;
  const [isAddHenchmanDialogOpen, setIsAddHenchmanDialogOpen] = useState(false);

  const handleAddHenchman = () => {
    if (group.id) {
      setIsAddHenchmanDialogOpen(true);
      return;
    }
    onUpdate(index, (current) => ({
      ...current,
      henchmen: [...current.henchmen, { id: 0, name: "", kills: 0, dead: false }],
    }));
  };

  const handleAddHenchmanConfirm = (result: AddHenchmanResult) => {
    onUpdate(index, (current) => ({
      ...current,
      henchmen: [
        ...current.henchmen,
        {
          id: 0,
          name: result.name,
          kills: 0,
          dead: false,
          cost: String(result.cost),
          itemChoices: result.itemChoices,
        },
      ],
    }));
    setIsAddHenchmanDialogOpen(false);
  };

  const handleUpdateHenchman = (hIdx: number, field: string, value: string | number | boolean) => {
    onUpdate(index, (current) => ({
      ...current,
      henchmen: current.henchmen.map((h, i) => (i === hIdx ? { ...h, [field]: value } : h)),
    }));
  };

  const handleRemoveHenchman = (hIdx: number) => {
    if (group.henchmen.length === 1) {
      onRemove(index);
      return;
    }
    onUpdate(index, (current) => ({
      ...current,
      henchmen: current.henchmen.filter((_, i) => i !== hIdx),
    }));
  };

  return (
    <>
      <p className="text-xs text-muted-foreground">Group members</p>
      {group.henchmen.length === 0 ? (
        <p className="text-sm text-muted-foreground">No henchmen yet.</p>
      ) : (
        <div className="space-y-2">
          {group.henchmen.map((henchman, hIdx) => (
            <div key={henchman.id || `new-${hIdx}`} className="group flex items-center gap-2">
              <Input
                value={henchman.name}
                onChange={(e) => handleUpdateHenchman(hIdx, "name", e.target.value)}
                placeholder="Henchman name"
                className={`${inputClassName} flex-1 ${hasFieldError("henchmen_names") && !henchman.name?.trim() ? "border-red-500" : ""}`}
              />
              {group.id && !henchman.id ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {henchman.cost !== undefined &&
                  henchman.cost !== null &&
                  String(henchman.cost).trim() !== ""
                    ? `${henchman.cost} gc`
                    : "0 gc"}
                </span>
              ) : null}
              <button
                type="button"
                className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                onClick={() => setHenchmanToRemove(hIdx)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={henchmanToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setHenchmanToRemove(null);
        }}
        description={
          group.henchmen.length === 1 ? (
            <DismissUnitDescription
              verb="disband"
              name={group.name?.trim() || "this group"}
              isQueued={!group.id}
            />
          ) : (
            <span>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">
                {henchmanToRemove !== null
                  ? group.henchmen[henchmanToRemove]?.name || `Henchman ${henchmanToRemove + 1}`
                  : ""}
              </span>
              ? He leaves the group when you save.
            </span>
          )
        }
        confirmText="Remove"
        onConfirm={() => {
          if (henchmanToRemove !== null) handleRemoveHenchman(henchmanToRemove);
          setHenchmanToRemove(null);
        }}
        onCancel={() => setHenchmanToRemove(null)}
      />
      <div className="mt-2 space-y-1">
        <Button type="button" size="sm" onClick={handleAddHenchman}>
          + Add henchman
        </Button>
        {/* Warn only (decision 12): the group may grow past its max size. */}
        {maxSize > 0 && group.henchmen.length > maxSize ? (
          <p role="status" className="text-xs text-amber-400">
            This group has {group.henchmen.length} henchmen, over its maximum size of {maxSize}.
          </p>
        ) : null}
      </div>
      <AddHenchmanDialog
        open={isAddHenchmanDialogOpen}
        onOpenChange={setIsAddHenchmanDialogOpen}
        group={group}
        stashQtyById={stashQtyById}
        onConfirm={handleAddHenchmanConfirm}
      />
    </>
  );
}
