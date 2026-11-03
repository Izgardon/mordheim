import type { ReactNode } from "react";

import { Bone } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import WebTopBar from "./WebTopBar";

/** The rail's groups while the campaign loads: a caption over its links. */
const RAIL_GROUPS = [2, 1, 9];

/** The nav rail while the campaign loads: its name, the tools, the groups, the footer. */
function RailBones() {
  return (
    <div className="flex min-h-full flex-col gap-[22px] px-3.5 py-[22px]">
      <div className="flex flex-col gap-2 px-2.5">
        <Bone className="h-2.5 w-16" />
        <Bone className="h-5 w-40" />
        <Bone className="h-2.5 w-14" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 px-2.5">
        {[0, 1, 2].map((index) => (
          <Bone key={index} className="h-11" />
        ))}
      </div>
      {RAIL_GROUPS.map((links, group) => (
        <div key={group} className="flex flex-col gap-1">
          <Bone className="mx-2.5 mb-1.5 h-2.5 w-20" />
          {Array.from({ length: links }, (_, index) => (
            <span key={index} className="flex min-h-[38px] items-center px-2.5">
              <Bone className={cn("h-3", index % 2 ? "w-24" : "w-20")} />
            </span>
          ))}
        </div>
      ))}
      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2.5 pt-3.5">
        <Bone className="h-[30px] w-[30px]" />
        <Bone className="h-3 w-24" />
      </div>
    </div>
  );
}

/** The phone's bars while the campaign loads: the top bar and the bottom nav. */
function PhoneBars({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-page">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-rail pb-2.5 pl-4 pr-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <div className="flex flex-col gap-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-5 w-32" />
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <Bone key={index} className="h-11 w-11" />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 pt-3">{children}</div>
      <div className="grid grid-cols-5 border-t border-line bg-rail px-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="flex flex-col items-center gap-1.5 py-1">
            <Bone className="h-5 w-5" />
            <Bone className="h-2 w-12" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The campaign shell before the campaign has loaded (design E): the web bar (its Campaigns and Log
 * out already there) and the rail, or the top bar and bottom nav (phone), as skeletons, around
 * the page's own skeleton, so a move into a campaign never shows a blank screen or the
 * full-screen loader.
 */
export default function ShellSkeleton({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  if (isMobile) return <PhoneBars>{children}</PhoneBars>;
  return (
    <main className="desktop-shell">
      <div className="desktop-shell__bar">
        <WebTopBar />
      </div>
      <aside className="desktop-shell__rail" aria-hidden="true">
        <RailBones />
      </aside>
      <div className="desktop-shell__main">
        <div className="desktop-shell__content">
          <div className="desktop-shell__content-inner">{children}</div>
        </div>
      </div>
    </main>
  );
}
