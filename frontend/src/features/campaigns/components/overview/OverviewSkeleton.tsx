import {
  Bone,
  boneWidth,
  SkeletonHeader,
  SkeletonHeading,
  SkeletonPage,
  SkeletonRows,
  SkeletonStats,
} from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { OVERVIEW_ASIDE, OVERVIEW_BODY, OVERVIEW_DIVIDED, OVERVIEW_MAIN } from "./overview-layout";

/** Chronicle entries while they load: the kind's bar, then three lines, under hairlines. */
export function ChronicleBones({ isMobile, rows = 5 }: { isMobile: boolean; rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn("flex gap-3 border-t border-line", isMobile ? "py-2.5" : "py-3")}
        >
          <Bone className="w-1 shrink-0 self-stretch" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <Bone className="h-2.5 w-16" />
            <Bone className="h-3.5" style={{ width: boneWidth(index + 1) }} />
            <Bone className="h-2.5 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A row of chips (the readiness chips, the chronicle's filters). */
function Chips({ count, className }: { count: number; className: string }) {
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {Array.from({ length: count }, (_, index) => (
        <Bone key={index} className={cn("shrink-0", className)} />
      ))}
    </div>
  );
}

/** The phone's overview: who is ready, the two buttons, the stats, the four tabs, the standings. */
/** Between battles while the players load: the web bar's on the overview. */
export function ReadinessBones() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-x-6 overflow-hidden" aria-hidden="true">
      <div className="flex shrink-0 items-center gap-3">
        <Bone className="h-2.5 w-28" />
        <Bone className="h-5 w-32" />
      </div>
      <Chips count={4} className="h-[34px] w-32" />
    </div>
  );
}

function PhoneOverview() {
  return (
    <SkeletonPage label="Loading the overview" className="flex flex-col gap-3 pb-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Bone className="h-2.5 w-28" />
          <Bone className="h-4 w-24" />
        </div>
        <Chips count={3} className="h-[34px] w-28" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2">
        <Bone className="h-12" />
        <Bone className="h-12" />
        <Bone className="h-12" />
      </div>
      <SkeletonStats cells={4} />
      <div className="grid grid-cols-4 border-b border-line">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className="flex min-h-11 items-center justify-center">
            <Bone className={cn("h-3 w-16", index ? null : "bg-strong")} />
          </span>
        ))}
      </div>
      <SkeletonRows rows={4} />
    </SkeletonPage>
  );
}

/**
 * The overview while it loads (design E): the header with Start battle and Report a result (the
 * web bar holds the readiness strip's bones), the stats line, then Standings and Battles beside
 * the Chronicle and Open bounties (web), or the four tabs (phone).
 */
export default function OverviewSkeleton() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  if (isMobile) return <PhoneOverview />;
  return (
    <SkeletonPage label="Loading the overview" className="flex flex-col gap-[26px] pb-14">
      <SkeletonHeader buttons={2} />
      <SkeletonStats cells={5} />
      <div className={OVERVIEW_BODY}>
        <div className={OVERVIEW_MAIN}>
          <section className="flex flex-col gap-3">
            <SkeletonHeading />
            <SkeletonRows rows={4} cells={3} head rowClass="min-h-[47px] py-1.5" />
          </section>
          <section className={cn("flex flex-col gap-3", OVERVIEW_DIVIDED)}>
            <SkeletonHeading />
            <SkeletonRows rows={4} rowClass="min-h-16" />
          </section>
        </div>
        <aside className={OVERVIEW_ASIDE}>
          <div className="flex flex-col gap-2.5">
            <Bone className="my-1 h-5 w-28" />
            <Chips count={6} className="h-8 w-[72px]" />
            <ChronicleBones isMobile={false} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Bone className="my-1 h-5 w-36" />
            <Bone className="h-[74px] w-full" />
          </div>
        </aside>
      </div>
    </SkeletonPage>
  );
}
