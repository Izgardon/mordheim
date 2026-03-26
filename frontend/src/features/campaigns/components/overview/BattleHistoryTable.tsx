import { Fragment, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { RosterSkeleton } from "@components/card-skeleton";
import basicBar from "@/assets/containers/basic_bar.webp";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  CampaignBattleHistoryEntry,
  CampaignBattleHistoryParticipant,
  CampaignPlayer,
} from "../../types/campaign-types";

type BattleHistoryTableProps = {
  isLoading: boolean;
  error: string;
  battles: CampaignBattleHistoryEntry[];
  players: CampaignPlayer[];
  isMobile: boolean;
};

const OVERVIEW_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

const formatListCell = (values: string[] | number[]) => (values.length > 0 ? values.join(", ") : "-");

const formatNumberCell = (value: number | null) => (typeof value === "number" ? String(value) : "-");

const DETAIL_ROWS = [
  {
    key: "kills",
    label: "Kills",
    renderValue: (participant: CampaignBattleHistoryParticipant) => formatNumberCell(participant.kills),
  },
  {
    key: "ooas",
    label: "OOAs",
    renderValue: (participant: CampaignBattleHistoryParticipant) => formatNumberCell(participant.ooas),
  },
  {
    key: "deaths",
    label: "Deaths",
    renderValue: (participant: CampaignBattleHistoryParticipant) => formatListCell(participant.deaths),
  },
  {
    key: "xp_gain",
    label: "XP Gain",
    renderValue: (participant: CampaignBattleHistoryParticipant) => formatNumberCell(participant.xp_gain),
  },
  {
    key: "exploration",
    label: "Exploration",
    renderValue: (participant: CampaignBattleHistoryParticipant) => formatListCell(participant.exploration),
  },
] as const;

const getInitialWarbandId = (
  battle: CampaignBattleHistoryEntry,
  currentUserWarbandId: number | null
) => {
  if (
    typeof currentUserWarbandId === "number" &&
    battle.participants.some((participant) => participant.warband_id === currentUserWarbandId)
  ) {
    return String(currentUserWarbandId);
  }
  const fallbackParticipant = battle.participants[0];
  return fallbackParticipant ? String(fallbackParticipant.warband_id) : "";
};

function BattleHistoryDetailTable({
  participants,
}: {
  participants: CampaignBattleHistoryParticipant[];
}) {
  return (
    <div className="max-h-[300px] overflow-x-auto overflow-y-auto rounded-lg border border-border/60 bg-black/20">
      <table className="w-full min-w-[560px] table-auto text-left text-sm text-foreground">
        <thead className="relative z-0">
          <tr className="border-b border-border/40 bg-black/35 text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
            <th className="w-[92px] px-2 py-2 font-semibold sm:px-3">Metric</th>
            {participants.map((participant) => (
              <th
                key={participant.warband_id}
                className="px-2 py-2 font-semibold align-top whitespace-normal sm:px-3"
              >
                {participant.warband_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DETAIL_ROWS.map((row) => (
            <tr key={row.key} className="border-b border-border/30 last:border-b-0">
              <th className="px-2 py-2 font-semibold align-top text-foreground sm:px-3">{row.label}</th>
              {participants.map((participant) => (
                <td
                  key={`${row.key}-${participant.warband_id}`}
                  className="px-2 py-2 align-top whitespace-normal break-words text-muted-foreground sm:px-3"
                >
                  {row.renderValue(participant)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BattleHistoryMobileDetail({
  battle,
  selectedWarbandId,
  onSelectedWarbandChange,
}: {
  battle: CampaignBattleHistoryEntry;
  selectedWarbandId: string;
  onSelectedWarbandChange: (value: string) => void;
}) {
  const selectedParticipant =
    battle.participants.find((participant) => String(participant.warband_id) === selectedWarbandId) ??
    battle.participants[0] ??
    null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">Warband</p>
        <Select value={selectedWarbandId} onValueChange={onSelectedWarbandChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select warband" />
          </SelectTrigger>
          <SelectContent>
            {battle.participants.map((participant) => (
              <SelectItem key={participant.warband_id} value={String(participant.warband_id)}>
                {participant.warband_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedParticipant ? (
        <div className="max-h-[300px] overflow-x-auto overflow-y-auto rounded-lg border border-border/60 bg-black/20">
          <table className="w-full table-auto text-left text-sm text-foreground">
            <thead className="relative z-0">
              <tr className="border-b border-border/40 bg-black/35 text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                <th className="w-[92px] px-2 py-2 font-semibold">Metric</th>
                <th className="px-2 py-2 font-semibold whitespace-normal">{selectedParticipant.warband_name}</th>
              </tr>
            </thead>
            <tbody>
              {DETAIL_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-border/30 last:border-b-0">
                  <th className="px-2 py-2 font-semibold align-top text-foreground">{row.label}</th>
                  <td className="px-2 py-2 align-top whitespace-normal break-words text-muted-foreground">
                    {row.renderValue(selectedParticipant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function BattleHistoryTable({
  isLoading,
  error,
  battles,
  players,
  isMobile,
}: BattleHistoryTableProps) {
  const { user } = useAuth();
  const [expandedBattleIds, setExpandedBattleIds] = useState<number[]>([]);
  const [selectedWarbandByBattleId, setSelectedWarbandByBattleId] = useState<Record<number, string>>({});

  const currentUserWarbandId = useMemo(() => {
    const player = players.find((entry) => entry.id === user?.id);
    return player?.warband?.id ?? null;
  }, [players, user?.id]);

  const toggleBattle = (battle: CampaignBattleHistoryEntry) => {
    setExpandedBattleIds((prev) => {
      const isExpanded = prev.includes(battle.id);
      if (isExpanded) {
        return prev.filter((entry) => entry !== battle.id);
      }
      return [...prev, battle.id];
    });
    setSelectedWarbandByBattleId((prev) => {
      if (prev[battle.id]) {
        return prev;
      }
      return {
        ...prev,
        [battle.id]: getInitialWarbandId(battle, currentUserWarbandId),
      };
    });
  };

  return (
    <Card className="w-full max-w-none">
      <CardHeader className="px-2 sm:px-6">
        <CardTitle>Battle History</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-0 sm:px-6">
        {isLoading ? (
          <RosterSkeleton rows={4} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : battles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No battles completed yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
            <div className="scrollbar-hidden-mobile max-h-[500px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="w-8 bg-black px-2 py-2 text-left font-semibold sm:w-10 sm:px-4 sm:py-3">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="bg-black px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Scenario</th>
                    <th className="bg-black px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Winners</th>
                    {!isMobile ? (
                      <th className="bg-black px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Date</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {battles.map((battle, index) => {
                    const isExpanded = expandedBattleIds.includes(battle.id);
                    const selectedWarbandId =
                      selectedWarbandByBattleId[battle.id] ?? getInitialWarbandId(battle, currentUserWarbandId);
                    return (
                      <Fragment key={battle.id}>
                        <tr
                          className="cursor-pointer border-b border-border/40 transition-[filter] hover:brightness-110"
                          style={{
                            ...OVERVIEW_ROW_BG_STYLE,
                            backgroundImage:
                              index % 2 === 0
                                ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), url(${basicBar})`
                                : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), url(${basicBar})`,
                          }}
                          onClick={() => toggleBattle(battle)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleBattle(battle);
                            }
                          }}
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
                            <span className="block max-w-[180px] truncate text-foreground sm:max-w-none">
                              {battle.scenario || "-"}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                            <span className="block max-w-[200px] truncate sm:max-w-none">
                              {battle.winners.length > 0 ? battle.winners.join(", ") : "-"}
                            </span>
                          </td>
                          {!isMobile ? (
                            <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                              {battle.date}
                            </td>
                          ) : null}
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td
                              colSpan={isMobile ? 3 : 4}
                              className="relative z-0 border-b border-border/40 bg-background/20 px-2 pb-3 sm:px-4 sm:pb-4"
                            >
                              <div className="relative z-0 pt-3">
                                {isMobile ? (
                                  <BattleHistoryMobileDetail
                                    battle={battle}
                                    selectedWarbandId={selectedWarbandId}
                                    onSelectedWarbandChange={(value) =>
                                      setSelectedWarbandByBattleId((prev) => ({
                                        ...prev,
                                        [battle.id]: value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <BattleHistoryDetailTable participants={battle.participants} />
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
