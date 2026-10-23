import { Pencil } from "lucide-react";

import { CardBackground } from "@/components/ui/card-background";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { EntryBadge } from "@/features/catalogue/components/EntryBadge";
import { useMediaQuery } from "@/lib/use-media-query";

import { beastKindLabel } from "../bestiary-kinds";
import { useBestiaryEntryDetail } from "../hooks/useBestiaryEntryDetail";
import {
  DETAIL_CHIP_CLASS,
  DetailHeader,
  DetailSection,
  EntryStatTable,
} from "./detail/entry-detail-parts";

type Chip = { key: string; name: string; text?: string | null };

/** A titled row of chips, each with its text in a tooltip; nothing when there are none. */
function ChipSection({ title, chips }: { title: string; chips: Chip[] }) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <DetailSection title={title}>
      {chips.map((chip) => (
        <Tooltip
          key={chip.key}
          trigger={<span className={DETAIL_CHIP_CLASS}>{chip.name}</span>}
          content={chip.text?.trim() || "No description available."}
        />
      ))}
    </DetailSection>
  );
}

type BestiaryEntryDetailProps = {
  campaignId: number;
  entryId: number;
  onClose: () => void;
  /** Edit (an `edit_catalogue` holder): opens the form on this beast. */
  onEdit?: () => void;
};

/**
 * One beast: its name and badge, Edit and Back, its kind, fluff, profile (or "No profile"), and
 * what it knows and carries.
 */
export default function BestiaryEntryDetail({
  campaignId,
  entryId,
  onClose,
  onEdit,
}: BestiaryEntryDetailProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { entry, isLoading, error } = useBestiaryEntryDetail(campaignId, entryId);
  const Wrapper = isMobile ? "div" : CardBackground;
  const surface = isMobile ? "" : "surface-panel-strong ";

  if (isLoading) {
    return (
      <Wrapper className={`${surface}px-2 py-4 sm:px-6 sm:py-6`}>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Wrapper>
    );
  }

  if (error || !entry) {
    return (
      <Wrapper className={`${surface}space-y-3 px-2 py-4 sm:px-6 sm:py-6`}>
        <p className="text-sm text-red-600">{error || "Entry not found"}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={`${surface}space-y-4 px-2 py-2 sm:px-6 sm:py-6`}>
      <DetailHeader
        name={entry.name}
        kind={beastKindLabel(entry.kind)}
        entry={entry}
        onClose={onClose}
        badge={<EntryBadge entry={entry} />}
        actions={
          onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : null
        }
      />

      {entry.description ? (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      ) : null}

      {entry.has_profile ? (
        <EntryStatTable entry={entry} />
      ) : (
        <p className="text-sm italic text-muted-foreground">No profile</p>
      )}

      <ChipSection
        title="Skills & Special Rules"
        chips={[
          ...entry.skills.map((skill) => ({
            key: `skill-${skill.id}`,
            name: skill.name,
            text: skill.description,
          })),
          ...entry.specials.map((special) => ({
            key: `special-${special.id}`,
            name: special.name,
            text: special.description,
          })),
        ]}
      />
      <ChipSection
        title="Spells"
        chips={entry.spells.map((spell) => ({
          key: `spell-${spell.id}`,
          name: spell.name,
          text: spell.description,
        }))}
      />
      <ChipSection
        title="Equipment"
        chips={entry.equipment.map((equip) => ({
          key: `item-${equip.item.id}`,
          name: `${equip.item.name}${equip.quantity > 1 ? ` x${equip.quantity}` : ""}`,
          text: equip.item.description,
        }))}
      />
    </Wrapper>
  );
}
