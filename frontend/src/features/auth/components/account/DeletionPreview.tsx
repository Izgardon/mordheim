import { Link } from "react-router-dom";

// types
import type { AccountDeletionPreview, DeletionCampaign } from "../../types/auth-types";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What happens to one campaign you're in. */
function outcomeText(campaign: DeletionCampaign) {
  if (campaign.outcome === "archived") {
    return campaign.archived
      ? "already archived, and it stays as it is."
      : "you're its only member, so it's archived and becomes read-only.";
  }
  return campaign.warband
    ? `you leave it. Your warband, ${campaign.warband.name}, stays as a retired record.`
    : "you leave it.";
}

/**
 * What deleting your account does, read from the server before anything is confirmed (AUTH-NEW-05,
 * decision 1): campaigns you must hand over first, each linked to where you hand it over; the
 * campaigns archived or left; the battles and trades that close; and what stays as "Former player".
 */
export function DeletionPreview({ preview }: { preview: AccountDeletionPreview }) {
  const blocking = preview.campaigns.filter((campaign) => campaign.outcome === "hand_over_first");
  const others = preview.campaigns.filter((campaign) => campaign.outcome !== "hand_over_first");

  return (
    <div className="space-y-3">
      {blocking.length > 0 ? (
        <div className="space-y-1">
          <p className="text-foreground">
            You own campaigns with other members. Hand each one to an admin first:
          </p>
          <ul className="list-disc space-y-1 pl-5" aria-label="Hand over first">
            {blocking.map((campaign) => (
              <li key={campaign.id}>
                {campaign.archived
                  ? `${campaign.name} is archived: restore it, then hand it over, or delete it for good. `
                  : `${campaign.name}: make an admin its owner. `}
                <Link
                  to={`/campaigns/${campaign.id}/settings?tab=campaign`}
                  className="underline hover:text-foreground"
                >
                  {`Open ${campaign.name}'s settings`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {others.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5" aria-label="Your campaigns">
          {others.map((campaign) => (
            <li key={campaign.id}>{`${campaign.name}: ${outcomeText(campaign)}`}</li>
          ))}
        </ul>
      ) : null}
      {preview.battles > 0 ? (
        <p>{`${plural(preview.battles, "open battle")} you're in: cancelled, or going on without you.`}</p>
      ) : null}
      {preview.trades > 0 ? <p>{`${plural(preview.trades, "open trade")}: closed.`}</p> : null}
      <p>
        Everything else of yours stays, shown as Former player: your warbands, battles, ledger, chat
        messages and bulletin notes. Your notifications are deleted, and your email can sign up
        again.
      </p>
    </div>
  );
}
