import { Bone, SkeletonHeader, SkeletonPage } from "@/components/ui/skeleton";

/** One account section: its title and description, a field or two, then its button. */
function SectionBones({ fields }: { fields: number }) {
  return (
    <div className="flex flex-col gap-4 border border-border bg-surface p-5 max-[960px]:p-4">
      <div className="flex flex-col gap-2.5 py-0.5">
        <Bone className="h-5 w-40" />
        <Bone className="h-3 w-80 max-w-full" />
      </div>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex w-full max-w-[420px] flex-col gap-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-12 w-full" />
        </div>
      ))}
      <Bone className="h-10 w-32" />
    </div>
  );
}

/**
 * Account while its code loads (design E): the header, then the display name, password,
 * sign-out-everywhere and delete sections.
 */
export default function AccountSkeleton() {
  return (
    <SkeletonPage label="Loading your account" className="flex flex-col gap-8 max-[960px]:gap-5">
      <SkeletonHeader title="w-48" />
      <div className="grid gap-4">
        <SectionBones fields={1} />
        <SectionBones fields={2} />
        <SectionBones fields={0} />
        <SectionBones fields={0} />
      </div>
    </SkeletonPage>
  );
}
