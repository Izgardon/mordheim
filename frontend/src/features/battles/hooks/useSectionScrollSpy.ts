import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getPostbattleSectionId,
  POSTBATTLE_SECTION_LABELS,
  type PostbattleSectionKey,
} from "@/features/battles/components/postbattle/PostbattleSection";

/** How far below the top of the screen the phone bars end. */
const TOP_OFFSET = 116;

const sectionTop = (section: PostbattleSectionKey) => {
  const element = document.getElementById(getPostbattleSectionId(section));
  return element ? element.getBoundingClientRect().top - TOP_OFFSET : null;
};

/**
 * The phone's postbattle section picker: its options (Stat changes only when the battle changed
 * any, Upkeep only with hired swords, Leaving only when someone is suggested to leave), jumping to a
 * section, and following the section scrolled to. A section picked stays picked while its jump
 * scrolls the page (the last, short one never reaches the top), until the player scrolls.
 */
export function useSectionScrollSpy({
  isMobile,
  hasUpkeep,
  hasStatChanges = false,
  hasLeaving = false,
}: {
  isMobile: boolean;
  hasUpkeep: boolean;
  hasStatChanges?: boolean;
  hasLeaving?: boolean;
}) {
  const [selectedSection, setSelectedSection] = useState<PostbattleSectionKey>("exploration");
  /** The section picked from the picker, until the player's own scroll (a touch, wheel or key). */
  const picked = useRef<PostbattleSectionKey | null>(null);
  const sectionOptions = useMemo(
    () => [
      { value: "exploration" as const, label: POSTBATTLE_SECTION_LABELS.exploration },
      { value: "roster" as const, label: POSTBATTLE_SECTION_LABELS.roster },
      ...(hasStatChanges
        ? [{ value: "stats" as const, label: POSTBATTLE_SECTION_LABELS.stats }]
        : []),
      { value: "finds" as const, label: POSTBATTLE_SECTION_LABELS.finds },
      ...(hasUpkeep ? [{ value: "upkeep" as const, label: POSTBATTLE_SECTION_LABELS.upkeep }] : []),
      ...(hasLeaving
        ? [{ value: "leaving" as const, label: POSTBATTLE_SECTION_LABELS.leaving }]
        : []),
    ],
    [hasLeaving, hasStatChanges, hasUpkeep]
  );

  const changeSection = useCallback((nextSectionValue: string) => {
    const nextSection = nextSectionValue as PostbattleSectionKey;
    picked.current = nextSection;
    setSelectedSection(nextSection);
    document
      .getElementById(getPostbattleSectionId(nextSection))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const validValues = new Set(sectionOptions.map((option) => option.value));
    if (!validValues.has(selectedSection)) {
      setSelectedSection(sectionOptions[0]?.value ?? "exploration");
    }
  }, [sectionOptions, selectedSection]);

  useEffect(() => {
    if (!isMobile || sectionOptions.length === 0) {
      return;
    }
    let frameHandle = 0;

    const syncSectionFromScroll = () => {
      frameHandle = 0;
      if (picked.current) {
        return;
      }
      let nextSection: PostbattleSectionKey | null = null;
      // The last section whose top has passed the bars...
      let bestPassedTop = Number.NEGATIVE_INFINITY;
      for (const option of sectionOptions) {
        const top = sectionTop(option.value);
        if (top !== null && top <= 0 && top > bestPassedTop) {
          bestPassedTop = top;
          nextSection = option.value;
        }
      }
      // ...or else the first one below them.
      if (!nextSection) {
        let nearestBelow = Number.POSITIVE_INFINITY;
        for (const option of sectionOptions) {
          const top = sectionTop(option.value);
          if (top !== null && top >= 0 && top < nearestBelow) {
            nearestBelow = top;
            nextSection = option.value;
          }
        }
      }
      setSelectedSection((prev) => (nextSection && prev !== nextSection ? nextSection : prev));
    };

    const onScroll = () => {
      if (frameHandle !== 0) {
        return;
      }
      frameHandle = window.requestAnimationFrame(syncSectionFromScroll);
    };

    // The player scrolling by hand hands the picker back to the scroll.
    const release = () => {
      picked.current = null;
    };
    const userScrolls = ["touchstart", "wheel", "keydown"] as const;

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    userScrolls.forEach((type) =>
      window.addEventListener(type, release, { passive: true, capture: true })
    );
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      userScrolls.forEach((type) => window.removeEventListener(type, release, true));
      if (frameHandle !== 0) {
        window.cancelAnimationFrame(frameHandle);
      }
    };
  }, [isMobile, sectionOptions]);

  return { selectedSection, sectionOptions, changeSection };
}
