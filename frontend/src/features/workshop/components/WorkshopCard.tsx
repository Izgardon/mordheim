import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyCode } from "@/components/ui/copy-code";
import { IconButton } from "@/components/ui/icon-button";
import { getErrorMessage } from "@/lib/get-error-message";

type WorkshopCardProps = {
  /** Its page in the workshop. */
  to: string;
  name: string;
  /** The line under the name: a warband's type; a list has none (William, 26 Nov 2026: "not important"). */
  kind?: string;
  shareCode: string;
  /** Deletes it (the confirm stays open, showing why, on a refusal). */
  onDelete: () => Promise<unknown>;
};

/**
 * A warband or warband list in my workshop: its name (the card's link, to its page), a warband's
 * type under it, its share code with Copy, and Delete.
 */
export default function WorkshopCard({ to, name, kind, shareCode, onDelete }: WorkshopCardProps) {
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirming(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      className="relative flex flex-col gap-1.5 p-5 transition-colors hover:border-accent-line max-[960px]:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          id={titleId}
          className="m-0 min-w-0 break-words font-display text-2xl font-semibold leading-tight text-head max-[960px]:text-[22px]"
        >
          <Link
            to={to}
            className="outline-none after:absolute after:inset-0 after:z-[1] after:content-[''] hover:text-accent-hi focus-visible:underline"
          >
            {name}
          </Link>
        </h3>
        <div className="relative z-[2] flex shrink-0 items-center gap-1.5">
          {shareCode ? <CopyCode code={shareCode} label="share code" /> : null}
          <IconButton
            look="plain"
            aria-label={`Delete ${name}`}
            className="h-9 w-9 text-danger"
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {kind ? (
        <p className="m-0 break-words text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {kind}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${name}?`}
        description="It's deleted for good. Campaigns it's in keep their copy."
        confirmText="Delete"
        isConfirming={deleting}
        onConfirm={() => void remove()}
      />
    </Card>
  );
}
