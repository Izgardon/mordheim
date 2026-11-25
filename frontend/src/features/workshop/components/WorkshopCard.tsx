import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyCode } from "@/components/ui/copy-code";
import { IconButton } from "@/components/ui/icon-button";
import { getErrorMessage } from "@/lib/get-error-message";

import { useDeleteWorkshop } from "../api/workshop-queries";

type WorkshopCardProps = {
  id: number;
  name: string;
  /** What it is: a warband's type, or the types a list serves. */
  kicker: string;
  /** The line under the name: a warband's cost against its budget. */
  facts?: ReactNode;
  shareCode: string;
};

/** The workshop's own page: its warband, or its list. */
export const workshopPath = (id: number) => `/workshop/${id}`;

/**
 * A custom warband or warband list on the Home page: what it is, its name (the card's link, to
 * its page), its cost where it is a warband, its share code with Copy, and Delete, which says
 * that copies imported elsewhere stay.
 */
export default function WorkshopCard({ id, name, kicker, facts, shareCode }: WorkshopCardProps) {
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteWorkshop();

  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      className="relative flex flex-col gap-2.5 p-5 transition-colors hover:border-accent-line max-[960px]:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {kicker}
        </span>
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
      <h3
        id={titleId}
        className="m-0 break-words font-display text-2xl font-semibold leading-tight text-head max-[960px]:text-[22px]"
      >
        <Link
          to={workshopPath(id)}
          className="outline-none after:absolute after:inset-0 after:z-[1] after:content-[''] hover:text-accent-hi focus-visible:underline"
        >
          {name}
        </Link>
      </h3>
      {facts}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${name}?`}
        description="Its code stops working. Copies already imported into campaigns or other workshops stay."
        confirmText="Delete"
        isConfirming={remove.isPending}
        onConfirm={() =>
          remove.mutate(id, {
            onSuccess: () => setConfirming(false),
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      />
    </Card>
  );
}

/** "Cost 455 / 500 gc", in the danger colour above the budget. */
export function CostLine({ cost, budget }: { cost: number; budget: number }) {
  return (
    <p className="m-0 text-sm text-text2">
      Cost{" "}
      <span className={cost > budget ? "font-bold text-danger" : "font-bold text-head"}>
        {cost} / {budget} gc
      </span>
    </p>
  );
}
