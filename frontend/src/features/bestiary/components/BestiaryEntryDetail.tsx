import { useEffect, useState } from "react";

import { CardBackground } from "@/components/ui/card-background";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/lib/use-media-query";
import { getBestiaryEntry } from "../api/bestiary-api";
import {
  DETAIL_CHIP_CLASS,
  DetailHeader,
  DetailSection,
  EntryStatTable,
} from "./detail/entry-detail-parts";

import type { BestiaryEntry } from "../types/bestiary-types";

type BestiaryEntryDetailProps = {
  entryId: number;
  onClose: () => void;
};

export default function BestiaryEntryDetail({ entryId, onClose }: BestiaryEntryDetailProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [entry, setEntry] = useState<BestiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const Wrapper = isMobile ? "div" : CardBackground;
  const loadingClassName = isMobile
    ? "px-2 py-4 sm:px-6 sm:py-6"
    : "surface-panel-strong px-2 py-4 sm:px-6 sm:py-6";
  const contentClassName = isMobile
    ? "space-y-4 px-2 py-2 sm:px-6 sm:py-6"
    : "surface-panel-strong space-y-4 px-2 py-2 sm:px-6 sm:py-6";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    getBestiaryEntry(entryId)
      .then((data) => {
        if (!cancelled) setEntry(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (isLoading) {
    return (
      <Wrapper className={loadingClassName}>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Wrapper>
    );
  }

  if (error || !entry) {
    return (
      <Wrapper className={`${loadingClassName} space-y-3`}>
        <p className="text-sm text-red-600">{error || "Entry not found"}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={contentClassName}>
      <DetailHeader name={entry.name} kind={entry.type} entry={entry} onClose={onClose} />

      {entry.description ? (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      ) : null}

      <EntryStatTable entry={entry} />

      {entry.skills.length > 0 || entry.specials.length > 0 ? (
        <DetailSection title="Skills & Special Rules">
          {entry.skills.map((skill) => (
            <Tooltip
              key={`skill-${skill.id}`}
              trigger={<span className={DETAIL_CHIP_CLASS}>{skill.name}</span>}
              content={skill.description?.trim() || "No description available."}
            />
          ))}
          {entry.specials.map((special) => (
            <Tooltip
              key={`special-${special.id}`}
              trigger={<span className={DETAIL_CHIP_CLASS}>{special.name}</span>}
              content={special.description?.trim() || "No description available."}
            />
          ))}
        </DetailSection>
      ) : null}

      {entry.spells.length > 0 ? (
        <DetailSection title="Spells">
          {entry.spells.map((spell) => (
            <Tooltip
              key={spell.id}
              trigger={<span className={DETAIL_CHIP_CLASS}>{spell.name}</span>}
              content={spell.description?.trim() || "No description available."}
            />
          ))}
        </DetailSection>
      ) : null}

      {entry.equipment.length > 0 ? (
        <DetailSection title="Equipment">
          {entry.equipment.map((equip) => (
            <Tooltip
              key={equip.item.id}
              trigger={
                <span className={DETAIL_CHIP_CLASS}>
                  {equip.item.name}
                  {equip.quantity > 1 ? ` x${equip.quantity}` : ""}
                </span>
              }
              content={equip.item.description?.trim() || "No description available."}
            />
          ))}
        </DetailSection>
      ) : null}
    </Wrapper>
  );
}
