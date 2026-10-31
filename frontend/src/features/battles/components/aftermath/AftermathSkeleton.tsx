import { Bone, SkeletonCard, SkeletonPage } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";

import { AFTERMATH_ASIDE, AFTERMATH_BODY, AFTERMATH_MAIN } from "./aftermath-layout";

/** The three step tabs, the first one current. */
function Tabs({ isMobile }: { isMobile: boolean }) {
  return isMobile ? (
    <div className="grid grid-cols-3 border-b border-line bg-rail">
      {[0, 1, 2].map((index) => (
        <span key={index} className="flex min-h-12 items-center justify-center gap-2">
          <Bone className="h-[22px] w-[22px]" />
          <Bone className="h-3 w-12" />
        </span>
      ))}
    </div>
  ) : (
    <div className="flex flex-wrap items-end gap-x-6">
      <div className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <span key={index} className="flex min-h-12 items-center gap-2 px-[18px]">
            <Bone className="h-[22px] w-[22px]" />
            <Bone className="h-3.5 w-20" />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 pb-3">
        <Bone className="h-2.5 w-24" />
        {[0, 1, 2, 3, 4].map((index) => (
          <Bone key={index} className="h-8 w-14" />
        ))}
      </div>
    </div>
  );
}

/** The battle's facts beside the steps: label and value rows under hairlines. */
function Facts() {
  return (
    <div className="flex flex-col gap-2.5 border border-border bg-surface px-[18px] py-4">
      <Bone className="h-2.5 w-20" />
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex justify-between gap-3 border-t border-line py-[9px]">
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * The Aftermath while it loads (design E): the header band with its kicker, title, result and the
 * three steps; then the step's cards beside the battle's facts (web), or under the sticky header
 * with the step bar at the foot (phone).
 */
export default function AftermathSkeleton() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  if (isMobile) {
    return (
      <SkeletonPage label="Loading the aftermath" className="flex flex-col gap-3 pb-24">
        <div className="-mx-3 bg-rail">
          <div className="flex items-center gap-3 py-3 pl-4 pr-3">
            <Bone className="h-5 w-5" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Bone className="h-4 w-36" />
              <Bone className="h-2.5 w-48" />
            </div>
            <Bone className="h-3 w-12" />
          </div>
          <Tabs isMobile />
        </div>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-line bg-rail px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-2.5">
          <Bone className="h-12 w-20" />
          <Bone className="h-12 flex-1" />
        </div>
      </SkeletonPage>
    );
  }
  return (
    <SkeletonPage label="Loading the aftermath" className="flex flex-col gap-7">
      <div className="page-band flex flex-col gap-3.5 border-b border-line bg-bar pt-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2.5 py-0.5">
            <Bone className="h-2.5 w-44" />
            <Bone className="h-7 w-72" />
            <Bone className="h-3 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Bone className="h-3 w-12" />
            <Bone className="h-11 w-11" />
          </div>
        </div>
        <Tabs isMobile={false} />
      </div>
      <div className={AFTERMATH_BODY}>
        <div className={AFTERMATH_MAIN}>
          <SkeletonCard lines={1} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
        <aside className={AFTERMATH_ASIDE}>
          <Facts />
        </aside>
      </div>
    </SkeletonPage>
  );
}
