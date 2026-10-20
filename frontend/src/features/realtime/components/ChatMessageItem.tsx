import { useState } from "react";
import { Trash2 } from "lucide-react";

import { ConfirmDialog } from "@components/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import type { CampaignMessage } from "@/features/campaigns/types/campaign-types";

/** "removed by admin" or "removed by its author" for a removed post (decision 8). */
export const removedLabel = (removedBy?: string | null) =>
  removedBy === "author" ? "removed by its author" : "removed by admin";

type ChatMessageItemProps = {
  message: CampaignMessage;
  isOwn: boolean;
  /** `capabilities.remove_posts`: owners and admins remove any message. */
  canRemove: boolean;
  onRemove: (messageId: number) => Promise<void>;
};

/** One chat message: its author and body, muted once removed, with Remove for moderators. */
export default function ChatMessageItem({
  message,
  isOwn,
  canRemove,
  onRemove,
}: ChatMessageItemProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState("");
  const isRemoved = Boolean(message.removed_at);

  const remove = async () => {
    setIsRemoving(true);
    setError("");
    try {
      await onRemove(message.id);
      setIsConfirmOpen(false);
    } catch (removeError) {
      setError(getErrorMessage(removeError, "Couldn't remove the message."));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
      <span className="flex items-center gap-1 px-1 text-[0.65rem] text-muted-foreground">
        {message.username}
        {canRemove && !isRemoved ? (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground/70 hover:text-red-300"
            aria-label={`Remove message from ${message.username}`}
            onClick={() => setIsConfirmOpen(true)}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </span>
      <div
        className={cn(
          "max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm",
          isRemoved
            ? "italic text-muted-foreground/70 surface-inline"
            : isOwn
              ? "bg-primary/20 text-primary-foreground"
              : "surface-inline text-foreground"
        )}
      >
        {isRemoved ? removedLabel(message.removed_by) : message.body}
      </div>
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Remove message"
        description={
          <div className="space-y-2">
            <p>{`Remove ${message.username}'s message for everyone?`}</p>
            <p className="text-xs">It stays in the chat, reading &quot;removed by admin&quot;.</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        }
        confirmText={isRemoving ? "Removing..." : "Remove"}
        confirmDisabled={isRemoving}
        isConfirming={isRemoving}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
