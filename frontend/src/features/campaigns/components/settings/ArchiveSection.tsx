import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

import type { CampaignCapabilities } from "../../capabilities";
import { isArchived } from "../../capabilities";
import { useCampaignLifecycle } from "../../hooks/settings/useCampaignLifecycle";
import type { CampaignSummary } from "../../types/campaign-types";
import { SettingsCard } from "./settings-ui";

/** What archiving does, said before the owner confirms (lossy actions say so). */
const ARCHIVE_EFFECTS = [
  "Open battles are cancelled. A battle already in its post-game ends as declared, and its post-game closes for everyone.",
  "Pending and accepted trades close.",
  "Its waiting notifications are cleared.",
  "The campaign becomes read-only for everyone: no settings, warbands, battles, trades or chat.",
];

const archivedOn = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

/**
 * Delete an archived campaign for good (CAMP-TWEAK-04): it says everything that goes, and waits
 * for the campaign's name, typed as it is spelt (surrounding spaces don't count).
 */
function DeleteForGood({
  campaignName,
  open,
  onOpenChange,
  lifecycle,
}: {
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifecycle: ReturnType<typeof useCampaignLifecycle>;
}) {
  const [typed, setTyped] = useState("");
  const deleting = lifecycle.pending === "delete";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
      title="Delete for good"
      description={
        <div className="flex flex-col gap-3">
          <p className="m-0 text-ink">
            {`${campaignName} and everything in it goes, for every member. This can't be undone.`}
          </p>
          <p className="m-0">
            Deleted with it: every warband and its units, every battle and its record, trades, logs
            and ledgers, house rules and their items, custom wargear, skills, spells and bestiary
            entries, the chat, and its notifications.
          </p>
          <label htmlFor="delete-campaign-typed" className="flex flex-col gap-1.5 text-sm text-ink">
            <span>
              Type <span className="font-bold">{campaignName}</span> to confirm
            </span>
            <Input
              id="delete-campaign-typed"
              value={typed}
              autoComplete="off"
              disabled={deleting}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
        </div>
      }
      error={lifecycle.error}
      confirmText={deleting ? "Deleting…" : "Delete for good"}
      confirmDisabled={typed.trim() !== campaignName}
      isConfirming={deleting}
      onConfirm={() => void lifecycle.deleteForGood(typed)}
    />
  );
}

/**
 * Settings → Archive (decision 5, CAMP-NEW-04): the owner archives the campaign, which closes its
 * open battles and trades and makes it read-only; an archived one is restored, or deleted for good
 * with its name typed. Each behind its confirm.
 */
export default function ArchiveSection({
  campaign,
  capabilities,
}: {
  campaign: CampaignSummary;
  capabilities: CampaignCapabilities;
}) {
  const lifecycle = useCampaignLifecycle(campaign);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const archived = isArchived(campaign);
  const date = archivedOn(campaign.archived_at);

  if (archived) {
    return (
      <SettingsCard
        title="Archived campaign"
        description={`Archived${date ? ` on ${date}` : ""}. The battles and trades it closed stay closed.`}
      >
        {lifecycle.error && !deleting ? (
          <p className="m-0 text-sm text-danger">{lifecycle.error}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {capabilities.restore ? (
            <Button
              disabled={lifecycle.pending === "restore"}
              onClick={() => void lifecycle.restore()}
            >
              {lifecycle.pending === "restore" ? "Restoring…" : "Restore campaign"}
            </Button>
          ) : null}
          {capabilities.delete ? (
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Delete for good
            </Button>
          ) : null}
        </div>
        <DeleteForGood
          campaignName={campaign.name}
          open={deleting}
          onOpenChange={(open) => {
            setDeleting(open);
            if (!open) lifecycle.clearError();
          }}
          lifecycle={lifecycle}
        />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Archive campaign"
      tone="danger"
      description="To delete it for good, archive it first."
      action={
        capabilities.archive ? (
          <Button variant="danger" onClick={() => setArchiving(true)}>
            Archive campaign
          </Button>
        ) : null
      }
    >
      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          setArchiving(open);
          if (!open) lifecycle.clearError();
        }}
        title="Archive campaign"
        description={
          <div className="flex flex-col gap-2">
            <p className="m-0 text-ink">{`Archive ${campaign.name}?`}</p>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
              {ARCHIVE_EFFECTS.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </div>
        }
        error={lifecycle.error}
        confirmText={lifecycle.pending === "archive" ? "Archiving…" : "Archive campaign"}
        isConfirming={lifecycle.pending === "archive"}
        onConfirm={() => void lifecycle.archive().then((done) => done && setArchiving(false))}
      />
    </SettingsCard>
  );
}
