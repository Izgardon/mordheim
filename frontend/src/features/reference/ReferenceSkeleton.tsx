import { Bone, nameWidth, SkeletonHeader, SkeletonPage } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** One reference row: the chevron, the name over its kind, then the web's cells. */
function RowBones({ index, cells, isMobile }: { index: number; cells: number; isMobile: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 py-2",
        isMobile ? "px-3" : "px-4",
        index ? "border-t border-line" : null
      )}
    >
      {isMobile ? null : <Bone className="h-3.5 w-3.5 shrink-0" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bone className="h-3.5" style={{ width: nameWidth(index) }} />
        {isMobile ? <Bone className="h-2.5 w-24" /> : null}
      </div>
      {Array.from({ length: isMobile ? 1 : cells }, (_, cell) => (
        <Bone key={cell} className="h-3 w-20 shrink-0" />
      ))}
      {isMobile ? <Bone className="h-4 w-4 shrink-0" /> : null}
    </div>
  );
}

/** The rows of a reference list while it loads, as one item of the list (ReferenceList). */
export function ReferenceRowBones({ cells = 1, rows = 8 }: { cells?: number; rows?: number }) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  return (
    <li role="status" aria-busy="true" aria-label="Loading the list">
      {Array.from({ length: rows }, (_, index) => (
        <RowBones key={index} index={index} cells={cells} isMobile={isMobile} />
      ))}
    </li>
  );
}

/**
 * A reference page while its code loads (design E): "Reference" and the title (the Section
 * picker on a phone), the search and chips over a hairline, the summary line, then the list with
 * its header row.
 */
export default function ReferenceSkeleton() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  return (
    <SkeletonPage
      label="Loading the reference"
      className="flex flex-col gap-6 pb-14 max-[960px]:gap-2.5"
    >
      {isMobile ? (
        <div className="flex items-center gap-2">
          <Bone className="h-3 w-14" />
          <Bone className="h-10 w-40" />
        </div>
      ) : (
        <SkeletonHeader buttons={1} title="w-56" />
      )}
      <div className="flex flex-col gap-4 border-b border-line pb-5 max-[960px]:gap-2.5 max-[960px]:border-0 max-[960px]:pb-0">
        <div className="flex flex-col gap-1.5">
          {isMobile ? null : <Bone className="h-2.5 w-14" />}
          <Bone className="h-11 w-full" />
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {isMobile ? null : <Bone className="mr-2 h-2.5 w-10 self-center" />}
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Bone key={index} className={cn("h-9 shrink-0", index ? "w-24" : "w-12")} />
          ))}
        </div>
      </div>
      {isMobile ? null : (
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-3 w-36" />
          <Bone className="h-9 w-40" />
        </div>
      )}
      <div className="border border-border bg-surface">
        {isMobile ? null : (
          <div className="flex h-10 items-center gap-3 border-b border-border bg-rail px-4 pl-10">
            <Bone className="h-2.5 w-16" />
            <span className="flex-1" />
            <Bone className="h-2.5 w-20" />
            <Bone className="h-2.5 w-20" />
          </div>
        )}
        {Array.from({ length: 8 }, (_, index) => (
          <RowBones key={index} index={index} cells={2} isMobile={isMobile} />
        ))}
      </div>
    </SkeletonPage>
  );
}
