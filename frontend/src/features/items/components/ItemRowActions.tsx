import { useNavigate } from "react-router-dom";

import { Tooltip } from "@components/tooltip";
import { RestoreButton } from "@/features/catalogue/components/ArchivedView";
import { EditRowButton } from "@/features/catalogue/components/EditRowButton";

import BuyItemButton from "./AcquireItemDialog/BuyItemButton";

import type { ItemRow } from "./items-columns";

type ItemRowActionsProps = {
  item: ItemRow;
  campaignId: number;
  /** \`edit_catalogue\`: Edit, or Restore in the Archived list. */
  canEdit: boolean;
  /** The row is in the Archived list: Restore is all it offers. */
  archived: boolean;
  /** This row's Acquire dialog is open (\`aria-expanded\`). */
  isAcquiring: boolean;
  onAcquire: () => void;
  onEdit: () => void;
};

/**
 * A Wargear row's buttons: its animal's bestiary entry, Acquire and Edit (every item: a book
 * item's edit makes the campaign's version, a rule's clone detaches); in the Archived list,
 * Restore.
 */
export default function ItemRowActions({
  item,
  campaignId,
  canEdit,
  archived,
  isAcquiring,
  onAcquire,
  onEdit,
}: ItemRowActionsProps) {
  const navigate = useNavigate();
  if (archived) {
    return (
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        {canEdit ? <RestoreButton kind="items" campaignId={campaignId} entry={item} /> : null}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {item.bestiary_entry ? (
        <Tooltip
          trigger={
            <button
              type="button"
              aria-label="View bestiary entry"
              onClick={() =>
                navigate(`/campaigns/${campaignId}/bestiary?entry=${item.bestiary_entry!.id}`)
              }
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground"
            >
              Bestiary
            </button>
          }
          content="View bestiary entry"
        />
      ) : null}
      <BuyItemButton
        item={item}
        aria-haspopup="dialog"
        aria-expanded={isAcquiring}
        onClick={onAcquire}
      />
      {canEdit ? <EditRowButton label="Edit item" onClick={onEdit} /> : null}
    </div>
  );
}
