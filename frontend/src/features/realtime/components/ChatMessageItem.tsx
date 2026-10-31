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
      <span className="flex items-center gap-1 text-[11px] font-bold text-faint">
        {message.username}
        {canRemove && !isRemoved ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center text-faint hover:text-danger"
            aria-label={`Remove message from ${message.username}`}
            onClick={() => setIsConfirmOpen(true)}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </span>
      <div
        className={cn(
          "max-w-[80%] break-words border px-3 py-2 text-sm",
          isRemoved
            ? "border-line bg-transparent italic text-faint"
            : isOwn
              ? "border-accent-line bg-accent-soft text-ink"
              : "border-line bg-raised text-ink"
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
            {error ? <p className="text-sm text-danger">{error}</p> : null}
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
