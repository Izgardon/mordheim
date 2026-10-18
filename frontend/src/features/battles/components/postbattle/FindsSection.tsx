import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommittedNumberInput } from "@/components/ui/committed-number-input";
import FindItemPicker from "@/features/battles/components/postbattle/FindItemPicker";
import PostbattleSection, {
  POSTBATTLE_SECTION_LABELS,
} from "@/features/battles/components/postbattle/PostbattleSection";
import type { FindItemSearch } from "@/features/battles/hooks/useFindItemSearch";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import { cn } from "@/lib/utils";

/** Finds: gold crowns, and the items found (added to the stash at finalise). */
export default function FindsSection({
  isMobile,
  draft,
  finds,
  isFinalized,
}: {
  isMobile: boolean;
  draft: BattlePostbattleState | null;
  finds: FindItemSearch;
  isFinalized: boolean;
}) {
  return (
    <PostbattleSection
      section="finds"
      isMobile={isMobile}
      className={cn(
        !isMobile && "battle-postbattle-finds-section",
        isMobile && "battle-mobile-section-divider"
      )}
    >
      <div>
        <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.finds}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Gold Crowns
          </span>
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
            <CommittedNumberInput
              value={draft?.finds.gold_crowns ?? 0}
              min={0}
              fallbackValue={0}
              className="field-surface h-10 !rounded-none"
              disabled={isFinalized}
              onCommit={finds.commitGold}
            />
            <div className="battle-metric-box flex h-10 items-center justify-center px-3 text-sm font-semibold text-foreground">
              gc
            </div>
          </div>
        </label>
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Item Box
          </span>
          <div className="battle-inline-panel min-h-[8.5rem] space-y-3 p-3">
            <FindItemPicker finds={finds} disabled={isFinalized} />
            {draft?.finds.items.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {draft.finds.items.map((item, index) => (
                  <div
                    key={`${item.item_id}-${index}`}
                    className="battle-card flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {item.name}
                    </p>
                    {!isFinalized ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 rounded-none"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => finds.removeItem(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[5.5rem] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No found items added yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </PostbattleSection>
  );
}
