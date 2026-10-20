import { useState } from "react";
import { Trash2 } from "lucide-react";

import { ConfirmDialog } from "@components/confirm-dialog";
import { removedLabel } from "@/features/realtime/components/ChatMessageItem";
import { cn } from "@/lib/utils";

import type { CampaignBulletinEntry, PostRemovedBy } from "../../types/campaign-types";

type BulletinEntryItemProps = {
  entry: CampaignBulletinEntry;
  isFirst: boolean;
  /** Its author, or an owner or admin (`remove_posts`), may remove it (decision 8). */
  canRemove: boolean;
  /** You wrote it: a removal reads "removed by its author". */
  isOwn: boolean;
  isRemoving: boolean;
  onRemove: (entryId: number, removedBy: PostRemovedBy) => Promise<unknown>;
};

/** A bulletin note: its body, or "removed by ..." once removed, with Remove behind a confirm. */
export default function BulletinEntryItem({
  entry,
  isFirst,
  canRemove,
  isOwn,
  isRemoving,
  onRemove,
}: BulletinEntryItemProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isRemoved = Boolean(entry.removed_at);

  return (
    <li className={cn("border-b border-[#6b4724]/55 px-1 py-2 last:border-b-0", isFirst && "pt-0")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isRemoved ? (
            <p className="text-sm italic leading-6 text-[#b7976b]/80">
              {removedLabel(entry.removed_by)}
            </p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#f2dfbf]">
              {entry.body}
            </p>
          )}
        </div>
        {canRemove && !isRemoved ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#6f4b29]/65 bg-black/15 text-[#d8b17b] transition hover:border-[#9a6f3d] hover:text-[#f0d3a4]"
            aria-label={`Remove bulletin note ${entry.id}`}
            disabled={isRemoving}
            onClick={() => setIsConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Remove note"
        description="Remove this note for everyone? It stays on the board, reading that it was removed."
        confirmText={isRemoving ? "Removing..." : "Remove"}
        confirmDisabled={isRemoving}
        isConfirming={isRemoving}
        onConfirm={() => {
          setIsConfirmOpen(false);
          void onRemove(entry.id, isOwn ? "author" : "admin").catch(() => undefined);
        }}
      />
    </li>
  );
}
