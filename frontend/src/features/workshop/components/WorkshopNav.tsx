import type { IconType } from "react-icons";
import { GiTiedScroll } from "react-icons/gi";
import { Link, useLocation } from "react-router-dom";

import { GAME_ICONS } from "@/components/ui/game-icons";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { CONTENT_KINDS, workshopPath } from "../paths";

/** A chip that is a link (pressed: its page is open). */
export const CHIP_LINK =
  "inline-flex min-h-[34px] shrink-0 items-center border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-[960px]:min-h-10";

type NavChipProps = { to: string; current: boolean; label: string; icon: IconType };

/** A nav pill: its icon, then its label. */
function NavChip({ to, current, label, icon: Icon }: NavChipProps) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={cn(
        CHIP_LINK,
        "gap-1.5",
        current
          ? "border-accent-line bg-accent-soft text-accent-hi"
          : "border-border text-text2 hover:bg-raised hover:text-ink"
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

/**
 * The workshop's own nav: its warbands (a warband's page among them), its lists, My content by
 * kind. On a phone one row scrolling sideways with the gap every such row keeps between its chips
 * and its scrollbar (`scroll-row`); on the web the chips wrap.
 */
export default function WorkshopNav({ workshopId }: { workshopId: number }) {
  const base = workshopPath(workshopId);
  const rest = useLocation().pathname.slice(base.length).replace(/^\//, "");
  const section = rest.split("/")[0] ?? "";
  const isMobile = useMediaQuery("(max-width: 960px)");
  return (
    <nav
      aria-label="Workshop"
      className={cn("flex gap-1.5", isMobile ? "scroll-row -mx-4 px-4" : "flex-wrap")}
    >
      <NavChip
        to={base}
        current={section === "" || section === "warbands"}
        label="Warbands"
        icon={GAME_ICONS.warbands}
      />
      <NavChip
        to={workshopPath(workshopId, "lists")}
        current={section === "lists"}
        label="Lists"
        icon={GiTiedScroll}
      />
      <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-line" />
      {CONTENT_KINDS.map((kind) => (
        <NavChip
          key={kind.path}
          to={workshopPath(workshopId, kind.path)}
          current={section === kind.path}
          label={kind.label}
          icon={kind.icon}
        />
      ))}
    </nav>
  );
}
