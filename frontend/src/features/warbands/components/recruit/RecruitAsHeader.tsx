import { ChevronLeft } from "lucide-react";

/** The Recruit as caption with the way back to the list of fighters, over whatever was picked. */
export default function RecruitAsHeader({ onChange }: { onChange: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-bold text-muted-foreground">Recruit as</span>
      <button
        type="button"
        className="flex min-h-11 items-center gap-1 text-xs font-bold text-accent-text"
        onClick={onChange}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Change
      </button>
    </div>
  );
}
