import { Bone, SkeletonCard, SkeletonPage, SkeletonRow } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** A fighter's card: name and Kill, the profile, the status with wounds, Gear and Skills. */
function FighterBones() {
  return (
    <div className="flex flex-col gap-3 border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <Bone className="h-4 w-36" />
        <Bone className="h-11 w-20" />
      </div>
      <div className="grid grid-cols-10 gap-x-2 border-y border-line py-2">
        {Array.from({ length: 10 }, (_, index) => (
          <Bone key={index} className="mx-auto h-5 w-3" />
        ))}
      </div>
      <div className="flex gap-2">
        <Bone className="h-11 flex-1" />
        <Bone className="h-11 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Bone className="h-11" />
        <Bone className="h-11" />
      </div>
    </div>
  );
}

/** The sides strip: one chip per warband, its casualties and rout bar. */
function StripBones() {
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {[0, 1].map((index) => (
        <Bone key={index} className="h-[54px] w-[150px] shrink-0" />
      ))}
    </div>
  );
}

/** The battle screen on a phone: its own bar, the sides, the feed, the cards, the tools. */
function PhoneBattle() {
  return (
    <SkeletonPage label="Loading the battle" className="fixed inset-0 z-30 flex flex-col bg-page">
      <div className="flex items-center gap-3 border-b border-line bg-rail px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <Bone className="h-5 w-5" />
        <div className="flex flex-1 flex-col gap-2">
          <Bone className="h-4 w-36" />
          <Bone className="h-2.5 w-24" />
        </div>
        <Bone className="h-11 w-28" />
      </div>
      <div className="border-b border-line bg-bar px-3 py-2">
        <StripBones />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3 pt-2.5">
        <Bone className="h-[118px]" />
        <FighterBones />
        <FighterBones />
      </div>
      <div className="grid grid-cols-5 border-t border-line bg-rail px-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="flex flex-col items-center gap-1.5 py-1">
            <Bone className="h-5 w-5" />
            <Bone className="h-2 w-10" />
          </span>
        ))}
      </div>
    </SkeletonPage>
  );
}

/** Before the battle: the header, your units to pick, and who is coming beside them. */
function Prebattle({ isMobile }: { isMobile: boolean }) {
  return (
    <SkeletonPage label="Loading the battle" className="flex flex-col gap-4 py-3">
      <div className="flex flex-col gap-2.5 py-0.5">
        <Bone className="h-2.5 w-36" />
        <Bone className="h-7 w-64" />
        <Bone className="h-3 w-80 max-w-full" />
      </div>
      <div className={cn("flex flex-wrap items-start gap-6", isMobile && "flex-col")}>
        <div className="flex w-full min-w-0 flex-[999_1_520px] flex-col gap-3 border border-border bg-surface p-4">
          <Bone className="h-5 w-32" />
          <div className="border-t border-line">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonRow
                key={index}
                index={index}
                className={cn("px-0", index ? "border-t border-line" : null)}
              />
            ))}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-[1_1_300px] flex-col gap-4">
          <SkeletonCard lines={3} className="p-4" />
          <SkeletonCard lines={1} className="p-4" />
        </div>
      </div>
    </SkeletonPage>
  );
}

/**
 * The battle while it loads (design E): the battle screen (its header with the tools and Next
 * round, the sides, the fighters' cards beside the feed), or before the battle, the pre-battle.
 */
export default function BattleSkeleton({ phase }: { phase?: string | null }) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  if (phase === "prebattle") return <Prebattle isMobile={isMobile} />;
  if (isMobile) return <PhoneBattle />;
  return (
    <SkeletonPage label="Loading the battle" className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-col gap-2.5 py-0.5">
          <Bone className="h-2.5 w-40" />
          <Bone className="h-7 w-56" />
          <Bone className="h-2.5 w-24" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4].map((index) => (
            <Bone key={index} className="h-11 w-24" />
          ))}
          <Bone className="h-11 w-32" />
        </div>
      </div>
      <StripBones />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,360px)] items-start gap-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2.5">
          {[0, 1, 2, 3].map((index) => (
            <FighterBones key={index} />
          ))}
        </div>
        <div className="flex h-[min(60vh,560px)] flex-col gap-3 border border-border bg-bar p-3">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-3 w-40" />
        </div>
      </div>
    </SkeletonPage>
  );
}
