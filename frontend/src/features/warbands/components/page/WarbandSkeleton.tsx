import type { ReactNode } from "react";

import {
  Bone,
  SkeletonHeader,
  SkeletonHeading,
  SkeletonPage,
  SkeletonStats,
  SkeletonTabs,
} from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { ROSTER_DIVIDED, ROSTER_HEROES, ROSTER_SECTIONS, WARBAND_INFO } from "./warband-layout";

/** The ten-cell profile under a unit's name. */
function StripBones() {
  return (
    <div className="grid grid-cols-10 border-y border-line">
      {Array.from({ length: 10 }, (_, index) => (
        <span key={index} className="flex flex-col items-center gap-1.5 pb-[9px] pt-2">
          <Bone className="h-2 w-3" />
          <Bone className="h-3 w-3" />
        </span>
      ))}
    </div>
  );
}

/** A unit card while loading, in its section's grid. */
function UnitBones() {
  return (
    <div className="flex min-w-0 flex-col gap-3 border border-border bg-surface p-3.5 pl-[18px]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-2 py-1">
          <Bone className="h-4 w-36" />
          <Bone className="h-2.5 w-20" />
        </div>
        <div className="flex gap-1.5">
          <Bone className="h-9 w-9" />
          <Bone className="h-9 w-9" />
        </div>
      </div>
      <StripBones />
      <Bone className="h-3 w-40" />
    </div>
  );
}

/** A roster section: its title and count, its Add button, then its units. */
function SectionBones({ divided, children }: { divided?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3", divided && ROSTER_DIVIDED)}>
      <div className="flex items-center justify-between gap-3">
        <SkeletonHeading />
        <Bone className="h-9 w-28" />
      </div>
      {children}
    </div>
  );
}

/**
 * The warband page while it loads (design E): the header with Store and Stash, the info line
 * beside the resources, the tabs, then the roster: heroes' and henchmen's cards in their grids, a
 * hairline between the sections.
 */
export default function WarbandSkeleton() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  return (
    <SkeletonPage label="Loading the warband" className="flex flex-col gap-6">
      <SkeletonHeader buttons={isMobile ? 0 : 3} />
      {isMobile ? (
        <div className="grid grid-cols-[1fr_1fr_44px] gap-2">
          <Bone className="h-11" />
          <Bone className="h-11" />
          <Bone className="h-11" />
        </div>
      ) : null}
      <div className={WARBAND_INFO}>
        <SkeletonStats cells={4} />
        <div className="flex items-center gap-4 border-y border-line py-3">
          <Bone className="h-2.5 w-20" />
          <Bone className="h-7 w-24" />
          <Bone className="ml-auto h-8 w-28" />
        </div>
      </div>
      <SkeletonTabs tabs={4} />
      <div className={ROSTER_SECTIONS}>
        <SectionBones>
          <div className={ROSTER_HEROES}>
            {[0, 1, 2].map((index) => (
              <UnitBones key={index} />
            ))}
          </div>
        </SectionBones>
        <SectionBones divided>
          <div className={ROSTER_HEROES}>
            <UnitBones />
            <UnitBones />
          </div>
        </SectionBones>
      </div>
    </SkeletonPage>
  );
}
