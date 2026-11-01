import { Bone, SkeletonHeader, SkeletonHeading, SkeletonPage } from "@/components/ui/skeleton";

/** The campaign cards' grid: as many 380 px cards per row as fit, one on a phone. */
export const CAMPAIGN_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr))]";

/** A campaign card while loading: role and state, the name, your warband, then its footer. */
function CardBones({ index }: { index: number }) {
  return (
    <div className="flex flex-col border border-border bg-surface">
      <div className="flex flex-col gap-3 p-5 max-[960px]:p-4">
        <div className="flex gap-1.5">
          <Bone className="h-[26px] w-14" />
          <Bone className="h-[26px] w-20" />
        </div>
        <Bone className="h-6" style={{ width: index % 2 ? "52%" : "66%" }} />
        <Bone className="h-3 w-44" />
      </div>
      <div className="flex items-center gap-6 border-t border-line px-5 py-3 max-[960px]:px-4">
        {[0, 1].map((cell) => (
          <div key={cell} className="flex flex-col gap-2">
            <Bone className="h-2.5 w-14" />
            <Bone className="h-3.5 w-12" />
          </div>
        ))}
        <Bone className="ml-auto h-8 w-16" />
      </div>
    </div>
  );
}

/** The campaign cards while the list loads. */
export function CampaignCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonPage label="Loading your campaigns" className={CAMPAIGN_GRID}>
      {Array.from({ length: count }, (_, index) => (
        <CardBones key={index} index={index} />
      ))}
    </SkeletonPage>
  );
}

/**
 * The campaigns page while its code loads (design E): the header with Join and Create, the
 * "Your campaigns" title with its count, and the cards.
 */
export default function CampaignsSkeleton() {
  return (
    <>
      <SkeletonHeader buttons={2} title="w-[min(260px,70%)]" />
      <div className="flex flex-col gap-4">
        <SkeletonHeading />
        <CampaignCardsSkeleton />
      </div>
    </>
  );
}
