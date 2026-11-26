import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

import { CONTENT_KINDS, workshopPath } from "../paths";

/** A chip that is a link (pressed: its page is open). */
export const CHIP_LINK =
  "inline-flex min-h-[34px] shrink-0 items-center border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-[960px]:min-h-10";

function NavChip({ to, current, label }: { to: string; current: boolean; label: string }) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={cn(
        CHIP_LINK,
        current
          ? "border-accent-line bg-accent-soft text-accent-hi"
          : "border-border text-text2 hover:bg-raised hover:text-ink"
      )}
    >
      {label}
    </Link>
  );
}

/** The workshop's own nav: its warbands (a warband's page among them), its lists, My content by kind. */
export default function WorkshopNav({ workshopId }: { workshopId: number }) {
  const base = workshopPath(workshopId);
  const rest = useLocation().pathname.slice(base.length).replace(/^\//, "");
  const section = rest.split("/")[0] ?? "";
  return (
    <nav
      aria-label="Workshop"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 min-[961px]:mx-0 min-[961px]:flex-wrap min-[961px]:px-0"
    >
      <NavChip to={base} current={section === "" || section === "warbands"} label="Warbands" />
      <NavChip to={workshopPath(workshopId, "lists")} current={section === "lists"} label="Lists" />
      <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-line" />
      {CONTENT_KINDS.map((kind) => (
        <NavChip
          key={kind.path}
          to={workshopPath(workshopId, kind.path)}
          current={section === kind.path}
          label={kind.label}
        />
      ))}
    </nav>
  );
}
