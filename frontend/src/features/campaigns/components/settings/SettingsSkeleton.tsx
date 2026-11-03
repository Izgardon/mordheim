import { Bone, boneWidth, SkeletonHeader, SkeletonPage } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** Setting rows while they load: a label over its hint, the control on the right, hairlines between. */
export function SettingRowsBones({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center justify-between gap-6 py-4",
            index ? "border-t border-line" : "pt-0"
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone className="h-3.5 w-32" />
            <Bone className="h-3" style={{ width: boneWidth(index + 1) }} />
          </div>
          <Bone className="h-11 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** A settings card: its title and description over a hairline, then its rows. */
function CardBones({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-4 border border-border bg-surface p-5 max-[960px]:p-4">
      <div className="flex flex-col gap-2.5 border-b border-line pb-4">
        <Bone className="h-5 w-36" />
        <Bone className="h-3 w-64 max-w-full" />
      </div>
      <SettingRowsBones rows={rows} />
    </div>
  );
}

/** The join code: its caption over the code, Copy and New code beside it. */
function JoinCodeBones() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-col gap-2">
        <Bone className="h-2.5 w-16" />
        <Bone className="h-5 w-24" />
      </div>
      <Bone className="h-8 w-14" />
      <Bone className="h-8 w-20" />
    </div>
  );
}

/**
 * Settings while its code loads (design E): the header with the join code over a hairline, the
 * section list beside the open section's card (web), or the join code and the section list
 * (phone).
 */
export default function SettingsSkeleton() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  if (isMobile) {
    return (
      <SkeletonPage label="Loading the settings" className="flex flex-col gap-4 pb-6">
        <div className="border border-border bg-surface p-4">
          <JoinCodeBones />
        </div>
        <div className="border border-border bg-surface">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className={cn(
                "flex min-h-[60px] items-center gap-3 px-4 py-2.5",
                index ? "border-t border-line" : null
              )}
            >
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-3.5 w-28" />
                <Bone className="h-2.5" style={{ width: boneWidth(index) }} />
              </div>
              <Bone className="h-4 w-4" />
            </div>
          ))}
        </div>
      </SkeletonPage>
    );
  }
  return (
    <SkeletonPage
      label="Loading the settings"
      className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 pb-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
        <SkeletonHeader title="w-52" className="flex-1" />
        <JoinCodeBones />
      </div>
      <div className="flex items-start gap-8">
        <div className="flex w-[220px] shrink-0 flex-col gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className={cn(
                "flex min-h-10 items-center border-l-2 px-3",
                index ? "border-transparent" : "border-strong"
              )}
            >
              <Bone className="h-3" style={{ width: `${[64, 52, 50, 80, 48, 60][index]}px` }} />
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <CardBones rows={3} />
          <CardBones rows={2} />
        </div>
      </div>
    </SkeletonPage>
  );
}

/** A settings section's rows while its data loads (the members, the open battles...). */
export function SettingsRowsLoading({ label, rows }: { label: string; rows?: number }) {
  return (
    <SkeletonPage label={label}>
      <SettingRowsBones rows={rows} />
    </SkeletonPage>
  );
}
