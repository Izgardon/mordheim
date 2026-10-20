import { useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { ConfirmDialog } from "@components/confirm-dialog";

import type { useCampaignLifecycle } from "../../hooks/settings/useCampaignLifecycle";
import type { CampaignSummary } from "../../types/campaign-types";

type ArchiveCampaignCardProps = {
  campaign: CampaignSummary;
  lifecycle: ReturnType<typeof useCampaignLifecycle>;
};

/** What archiving does, said before the owner confirms (lossy actions say so). */
const ARCHIVE_EFFECTS = [
  "Open battles are cancelled. A battle already in postbattle ends as declared, and its postbattle closes for everyone.",
  "Pending and accepted trades close.",
  "Its waiting notifications are cleared.",
  "The campaign becomes read-only for everyone: no settings, warbands, battles, trades or chat.",
  "You can restore it from Settings at any time.",
];

/** The owner's Archive campaign (decision 5, CAMP-NEW-04), in place of Close and Delete. */
export default function ArchiveCampaignCard({ campaign, lifecycle }: ArchiveCampaignCardProps) {
  const [open, setOpen] = useState(false);
  const isArchiving = lifecycle.pending === "archive";

  const close = () => {
    setOpen(false);
    lifecycle.clearError();
  };

  return (
    <CardBackground className="space-y-3 bg-[rgba(12,9,6,0.92)] p-3 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Archive campaign</h3>
      <p className="text-sm text-muted-foreground">
        Done with the campaign? Archiving keeps everything as it is, read-only, until you restore
        it. Deleting it for good is a separate step, from the archived campaign.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Archive campaign
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title="Archive campaign"
        description={
          <div className="space-y-2">
            <p>{`Archive ${campaign.name}?`}</p>
            <ul className="list-disc space-y-1 pl-5">
              {ARCHIVE_EFFECTS.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
            {lifecycle.error ? <p className="text-sm text-red-600">{lifecycle.error}</p> : null}
          </div>
        }
        confirmText={isArchiving ? "Archiving..." : "Archive campaign"}
        confirmDisabled={isArchiving}
        isConfirming={isArchiving}
        onConfirm={() => {
          void lifecycle.archive().then((done) => done && setOpen(false));
        }}
        onCancel={close}
      />
    </CardBackground>
  );
}
