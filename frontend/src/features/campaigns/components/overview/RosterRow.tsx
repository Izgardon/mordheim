import type { MouseEvent } from "react";

// routing
import { Link } from "react-router-dom";

// icons
import {
  ChevronDown,
  Eye,
  Shield,
  Skull,
  Swords,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

// components
import { Button } from "@components/button";
import UnitsTable from "./UnitsTable";

// types
import type { CampaignPlayer } from "../../types/campaign-types";
import type { RosterUnit } from "../../hooks/useCampaignOverview";

type WarbandRecordMetricProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  toneClassName?: string;
};

function normalizeRecordValue(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function WarbandRecordMetric({
  icon: Icon,
  label,
  value,
  toneClassName = "text-foreground",
}: WarbandRecordMetricProps) {
  return (
    <div
      role="listitem"
      aria-label={`${label}: ${value}`}
      className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card/70 px-2 py-2 text-center shadow-sm sm:justify-start sm:px-3"
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClassName}`} aria-hidden="true" />
      <span className={`text-sm font-semibold ${toneClassName}`}>{value}</span>
      <span className="sr-only sm:not-sr-only sm:text-[0.65rem] sm:font-semibold sm:uppercase sm:tracking-[0.18em] sm:text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function WarbandRecordStrip({ warband }: { warband: CampaignPlayer["warband"] }) {
  const wins = normalizeRecordValue(warband?.wins);
  const losses = normalizeRecordValue(warband?.losses);
  const battles = wins + losses;

  return (
    <div
      role="list"
      aria-label="Warband record"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-border/50 bg-background/40 p-2"
    >
      <WarbandRecordMetric icon={Swords} label="Battles" value={battles} />
      <WarbandRecordMetric icon={Trophy} label="Wins" value={wins} toneClassName="text-[#d4af37]" />
      <WarbandRecordMetric
        icon={Skull}
        label="Losses"
        value={losses}
        toneClassName="text-rose-300"
      />
    </div>
  );
}

type RosterRowProps = {
  campaignId: number;
  player: CampaignPlayer;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  units?: RosterUnit[];
  isUnitsLoading: boolean;
  unitsError: string;
};

/**
 * One player on the overview's roster and, expanded, their warband's record and units. The
 * player's name is the real expand button (CAMP-UX-07); a click anywhere else on the row does
 * the same for the mouse, and View warband is a link beside it, not inside it.
 */
export default function RosterRow({
  campaignId,
  player,
  index,
  isExpanded,
  onToggle,
  units,
  isUnitsLoading,
  unitsError,
}: RosterRowProps) {
  const warband = player.warband;
  const detailsId = `roster-${player.id}-units`;
  const toggleFromRow = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!(event.target as HTMLElement).closest("a, button")) {
      onToggle();
    }
  };

  return (
    <>
      <tr
        className={[
          "cursor-pointer border-b border-border/40 transition-colors",
          index % 2 === 0 ? "table-row-even" : "table-row-odd",
          isExpanded ? "table-row-active" : "table-row-hover",
        ].join(" ")}
        onClick={toggleFromRow}
      >
        <td className="px-2 py-2 align-middle sm:px-4 sm:py-3">
          <ChevronDown
            className={[
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
            ].join(" ")}
            aria-hidden="true"
          />
        </td>
        <td className="px-2 py-2 align-middle sm:px-4 sm:py-3">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? detailsId : undefined}
            onClick={onToggle}
            className="flex min-w-0 max-w-full items-center gap-1.5 text-left font-semibold text-foreground sm:gap-2"
          >
            <User
              className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block"
              aria-hidden="true"
            />
            <span className="block min-w-0 truncate sm:max-w-none">{player.name}</span>
          </button>
        </td>
        <td className="px-2 py-2 align-middle text-sm text-muted-foreground sm:px-4 sm:py-3">
          <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Shield className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block" />
            <span className="block min-w-0 truncate sm:max-w-none">
              {warband?.name || "Unassigned"}
            </span>
          </span>
        </td>
        <td className="hidden px-4 py-3 align-middle text-sm text-muted-foreground sm:table-cell">
          <span className="inline-flex items-center gap-2">
            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
            {warband?.faction || "-"}
          </span>
        </td>
        <td className="px-2 py-2 align-middle text-right whitespace-nowrap sm:px-4 sm:py-3">
          {warband ? (
            <Button asChild variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
              <Link to={`/campaigns/${campaignId}/warbands/${warband.id}`}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">View warband</span>
              </Link>
            </Button>
          ) : (
            <Button size="icon" variant="outline" className="h-9 w-9" disabled>
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">View warband</span>
            </Button>
          )}
        </td>
      </tr>
      {isExpanded ? (
        <tr id={detailsId}>
          <td
            colSpan={5}
            className="relative z-0 border-b border-border/40 bg-background/20 px-2 pb-3 sm:px-4 sm:pb-4"
          >
            {!warband ? (
              <p className="pt-3 text-sm text-muted-foreground">No warband assigned yet.</p>
            ) : (
              <div className="relative z-0 space-y-3 pt-3">
                <WarbandRecordStrip warband={warband} />
                {isUnitsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading warband...</p>
                ) : unitsError ? (
                  <p className="text-sm text-red-600">{unitsError}</p>
                ) : units && units.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto pr-1">
                    <UnitsTable units={units} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No units logged yet.</p>
                )}
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
