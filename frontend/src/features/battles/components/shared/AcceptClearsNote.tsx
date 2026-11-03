import { useOpenCampaignBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { acceptClearsNote } from "@/features/battles/utils/open-battles";
import { cn } from "@/lib/utils";

/**
 * Beside an invitation's Accept: the other pre-battles accepting it clears, from the open battles
 * list (one battle at a time; a lossy action says so). Nothing when it clears none.
 */
export default function AcceptClearsNote({
  campaignId,
  battleId,
  className,
}: {
  campaignId: number;
  battleId: number;
  className?: string;
}) {
  const { data } = useOpenCampaignBattles(campaignId);
  const note = acceptClearsNote(data ?? [], battleId);
  if (!note) {
    return null;
  }
  return (
    <p
      className={cn(
        "m-0 border border-danger-line bg-danger-bg px-3 py-2 text-sm text-danger",
        className
      )}
    >
      {note}
    </p>
  );
}
