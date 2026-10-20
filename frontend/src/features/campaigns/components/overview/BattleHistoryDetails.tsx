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
} from "../../types/campaign-types";

const formatListCell = (values: string[] | number[]) =>
  values.length > 0 ? values.join(", ") : "-";

const formatNumberCell = (value: number | null) =>
  typeof value === "number" ? String(value) : "-";

const DETAIL_ROWS = [
  {
    key: "kills",
    label: "Kills",
    renderValue: (participant: CampaignBattleHistoryParticipant) =>
      formatNumberCell(participant.kills),
  },
  {
    key: "ooas",
    label: "OOAs",
    renderValue: (participant: CampaignBattleHistoryParticipant) =>
      formatNumberCell(participant.ooas),
  },
  {
    key: "deaths",
    label: "Deaths",
    renderValue: (participant: CampaignBattleHistoryParticipant) =>
      formatListCell(participant.deaths),
  },
  {
    key: "xp_gain",
    label: "XP Gain",
    renderValue: (participant: CampaignBattleHistoryParticipant) =>
      formatNumberCell(participant.xp_gain),
  },
  {
    key: "exploration",
    label: "Exploration",
    renderValue: (participant: CampaignBattleHistoryParticipant) =>
      formatListCell(participant.exploration),
  },
] as const;

/** Every participant's figures for one battle, side by side (desktop). */
export function BattleHistoryDetailTable({
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
              <th className="px-2 py-2 font-semibold align-top text-foreground sm:px-3">
                {row.label}
              </th>
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

/** One participant's figures at a time, picked from a list (phones). */
export function BattleHistoryMobileDetail({
  battle,
  selectedWarbandId,
  onSelectedWarbandChange,
}: {
  battle: CampaignBattleHistoryEntry;
  selectedWarbandId: string;
  onSelectedWarbandChange: (value: string) => void;
}) {
  const selectedParticipant =
    battle.participants.find(
      (participant) => String(participant.warband_id) === selectedWarbandId
    ) ??
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
                <th className="px-2 py-2 font-semibold whitespace-normal">
                  {selectedParticipant.warband_name}
                </th>
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
