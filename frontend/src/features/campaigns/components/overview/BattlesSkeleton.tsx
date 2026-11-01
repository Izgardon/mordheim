import {
  Bone,
  boneWidth,
  nameWidth,
  SkeletonHeader,
  SkeletonHeading,
  SkeletonPage,
} from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** Battle rows while they load: the date over the scenario, who beat whom, the moments, a chevron. */
export function BattleRowsBones({ rows = 5, isMobile }: { rows?: number; isMobile: boolean }) {
  return (
    <div className="border border-border bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center",
            isMobile ? "min-h-[62px] gap-2.5 px-3" : "min-h-16 gap-5 px-[18px]",
            index ? "border-t border-line" : null
          )}
        >
          <div className={cn("flex flex-col gap-2", isMobile ? "flex-1" : "w-[140px] shrink-0")}>
            <Bone className="h-2.5 w-16" />
            <Bone className="h-3" style={{ width: isMobile ? boneWidth(index) : "100px" }} />
          </div>
          {isMobile ? null : (
            <>
              <Bone className="h-4 flex-1" style={{ maxWidth: nameWidth(index) }} />
              <Bone className="ml-auto h-3 w-16" />
            </>
          )}
          <Bone className="h-4 w-4 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** The Battles page while its code loads: the header, the section title and its count, the rows. */
export default function BattlesSkeleton() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  return (
    <SkeletonPage
      label="Loading the battles"
      className="flex flex-col gap-6 pb-14 max-[960px]:gap-3"
    >
      {isMobile ? null : <SkeletonHeader title="w-48" />}
      <SkeletonHeading />
      <BattleRowsBones isMobile={isMobile} />
    </SkeletonPage>
  );
}
