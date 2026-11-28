import { SidePanel } from "@/components/ui/side-panel";
import type { FoundPlace } from "@/features/exploration/utils/places-found";
import DiceRoller from "@/features/realtime/components/DiceRoller";
import { useDiceRoller } from "@/features/realtime/hooks/useDiceRoller";

/**
 * Explore's Read and roll (William, 28 Nov 2026: "Ideally in a way where I can read the text and
 * still roll"): the place's text above the table's dice roller, in one panel that scrolls, so the
 * player reads and rolls without leaving the step. Its roller is the top bar's (`DiceRoller`), a
 * fresh one per place (keyed by its name) whose rolls are logged for the place. Nothing rolled
 * here reaches the draft: the finds are typed into Finds.
 */
export default function PlaceRollPanel({
  campaignId,
  found,
  open,
  onOpenChange,
}: {
  campaignId: number;
  /** The place last opened, kept while the panel closes. */
  found: FoundPlace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const roller = useDiceRoller(campaignId, open, found?.place.name);
  return (
    <SidePanel
      open={open && found !== null}
      onOpenChange={onOpenChange}
      kicker={found?.kicker}
      title={found?.place.name ?? ""}
    >
      {found?.place.rules ? (
        <p className="m-0 whitespace-pre-line border-b border-accent-line pb-4 text-sm text-text2">
          {found.place.rules}
        </p>
      ) : null}
      <DiceRoller roller={roller} />
    </SidePanel>
  );
}
