import { Link } from "react-router-dom";
import { BookOpenText, ChevronRight } from "lucide-react";

/** The link to the Scenarios page beside the overview's campaign rules: its name alone. */
export default function ScenariosLink({ campaignId }: { campaignId: number }) {
  return (
    <section aria-label="Scenarios">
      <Link
        to={`/campaigns/${campaignId}/scenarios`}
        className="flex min-h-[52px] items-center gap-2.5 border-y border-line px-1 text-left no-underline"
      >
        <BookOpenText aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] text-accent-text">
            Scenarios
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}
