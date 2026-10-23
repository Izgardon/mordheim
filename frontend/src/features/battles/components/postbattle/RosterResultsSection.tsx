import HenchmenGroupResult from "@/features/battles/components/postbattle/HenchmenGroupResult";
import PostbattleSection, {
  POSTBATTLE_SECTION_LABELS,
} from "@/features/battles/components/postbattle/PostbattleSection";
import UnitResultCard from "@/features/battles/components/postbattle/UnitResultCard";
import type { PostbattleRowTools } from "@/features/battles/components/postbattle/postbattle-row-tools";
import type {
  PostbattlePetRow,
  PostbattleRenderableGroup,
} from "@/features/battles/components/postbattle/postbattle-utils";
import PostbattlePetRows from "@/features/battles/components/postbattle/PostbattlePetRows";

const SECTION_LABELS = { hero: "Heroes", hireling: "Hired Swords", henchman: "Henchmen" };

/** Roster: every unit's results, heroes, hired swords and henchmen groups under their headings,
 * then the pets that fought as their own models (step 5). */
export default function RosterResultsSection({
  isMobile,
  groups,
  pets = [],
  rosterLoading,
  rosterError,
  tools,
}: {
  isMobile: boolean;
  groups: PostbattleRenderableGroup[];
  pets?: PostbattlePetRow[];
  rosterLoading: boolean;
  rosterError: string | undefined;
  tools: PostbattleRowTools;
}) {
  return (
    <PostbattleSection
      section="roster"
      isMobile={isMobile}
      className={isMobile ? "battle-mobile-section-divider" : undefined}
    >
      <div>
        <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.roster}</p>
      </div>
      {rosterLoading ? <p className="text-sm text-muted-foreground">Loading roster...</p> : null}
      {rosterError ? <p className="text-sm text-red-600">{rosterError}</p> : null}
      {groups.map((group, index) => {
        const showSectionHeader = index === 0 || groups[index - 1]?.unitKind !== group.unitKind;
        return (
          <div key={group.key} className="space-y-3">
            {showSectionHeader ? (
              <p className="battle-section-title">{SECTION_LABELS[group.unitKind]}</p>
            ) : null}
            {group.unitKind === "henchman" ? (
              <HenchmenGroupResult group={group} tools={tools} />
            ) : (
              group.rows.map((row) => <UnitResultCard key={row.unitKey} row={row} tools={tools} />)
            )}
          </div>
        );
      })}
      <PostbattlePetRows pets={pets} />
    </PostbattleSection>
  );
}
