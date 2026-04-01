import { Fragment, useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { RosterSkeleton } from "@components/card-skeleton";
import { useMediaQuery } from "@/lib/use-media-query";

import type { CampaignActiveBattle } from "../../types/campaign-types";

type ActiveBattlesTableProps = {
  isLoading: boolean;
  error: string;
  battles: CampaignActiveBattle[];
  onCancelBattle: (battleId: number) => Promise<void>;
};

const battleTypeLabel = (flowType: CampaignActiveBattle["battle"]["flow_type"]) =>
  flowType === "reported_result" ? "Result request" : "Battle";

const battleStatusLabel = (status: CampaignActiveBattle["battle"]["status"]) => {
  switch (status) {
    case "inviting":
      return "Request sent";
    case "reported_result_pending":
      return "Awaiting replies";
    case "prebattle":
      return "Prebattle";
    case "active":
      return "Active";
    case "postbattle":
      return "Postbattle";
    case "ended":
      return "Ended";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
};

const participantStatusLabel = (status: CampaignActiveBattle["participants"][number]["status"]) => {
  switch (status) {
    case "invited":
      return "Invited";
    case "accepted":
      return "Accepted";
    case "reported_result_pending":
      return "Pending";
    case "reported_result_approved":
      return "Approved";
    case "reported_result_declined":
      return "Declined";
    case "joined_prebattle":
      return "Joined prebattle";
    case "ready":
      return "Ready";
    case "canceled_prebattle":
      return "Canceled";
    case "in_battle":
      return "In battle";
    case "finished_battle":
      return "Finished";
    case "confirmed_postbattle":
      return "Confirmed";
    default:
      return status;
  }
};

const formatCreatedAt = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "-";
  }
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getCreatorLabel = (battle: CampaignActiveBattle) =>
  battle.participants.find((participant) => participant.user.id === battle.battle.created_by_user_id)?.user.label ??
  "Unknown";

const getParticipantSummary = (battle: CampaignActiveBattle) =>
  battle.participants.map((participant) => participant.warband.name).join(", ");

export default function ActiveBattlesTable({
  isLoading,
  error,
  battles,
  onCancelBattle,
}: ActiveBattlesTableProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [expandedBattleIds, setExpandedBattleIds] = useState<number[]>([]);
  const [cancelTarget, setCancelTarget] = useState<CampaignActiveBattle | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const columnCount = isMobile ? 3 : 7;

  const expandedBattleIdSet = useMemo(() => new Set(expandedBattleIds), [expandedBattleIds]);

  const toggleBattle = (battleId: number) => {
    setExpandedBattleIds((prev) =>
      prev.includes(battleId) ? prev.filter((entry) => entry !== battleId) : [...prev, battleId]
    );
  };

  const closeCancelDialog = () => {
    if (isCanceling) {
      return;
    }
    setCancelTarget(null);
    setCancelError("");
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) {
      return;
    }

    setIsCanceling(true);
    setCancelError("");
    try {
      await onCancelBattle(cancelTarget.battle.id);
      setExpandedBattleIds((prev) => prev.filter((entry) => entry !== cancelTarget.battle.id));
      setCancelTarget(null);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setCancelError(errorResponse.message || "Unable to cancel battle");
      } else {
        setCancelError("Unable to cancel battle");
      }
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Active Battles</h3>
      {isLoading ? (
        <RosterSkeleton rows={4} />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : battles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active battles or battle requests.</p>
      ) : (
        <div className="table-shell overflow-hidden rounded-2xl">
          <div className="scrollbar-hidden-mobile max-h-[420px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="sticky top-0 z-20">
                <tr className="table-head-surface border-b border-border/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                    Creator
                  </th>
                  <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                    Scenario
                  </th>
                  {!isMobile ? (
                    <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                      Type
                    </th>
                  ) : null}
                  {!isMobile ? (
                    <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                      Status
                    </th>
                  ) : null}
                  {!isMobile ? (
                    <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                      Participants
                    </th>
                  ) : null}
                  {!isMobile ? (
                    <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                      Created
                    </th>
                  ) : null}
                  <th className="table-head-surface w-[92px] px-2 py-2 text-right font-semibold sm:px-4 sm:py-3">
                    Cancel
                  </th>
                </tr>
              </thead>
              <tbody>
                {battles.map((battleEntry, index) => {
                  const { battle } = battleEntry;
                  const creatorLabel = getCreatorLabel(battleEntry);
                  const participantSummary = getParticipantSummary(battleEntry);
                  const isExpanded = expandedBattleIdSet.has(battle.id);
                  return (
                    <Fragment key={battle.id}>
                      <tr
                        className={[
                          "cursor-pointer border-b border-border/40 transition-colors",
                          index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover",
                        ].join(" ")}
                        onClick={() => toggleBattle(battle.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleBattle(battle.id);
                          }
                        }}
                      >
                        <td className="px-2 py-2 align-middle sm:px-4 sm:py-3">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={[
                                "h-4 w-4 shrink-0 transition-transform",
                                isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
                              ].join(" ")}
                              aria-hidden="true"
                            />
                            <span className="block max-w-[120px] truncate text-foreground sm:max-w-none">
                              {creatorLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle sm:px-4 sm:py-3">
                          <span className="block max-w-[150px] truncate text-foreground sm:max-w-none">
                            {battle.scenario || "-"}
                          </span>
                        </td>
                        {!isMobile ? (
                          <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                            {battleTypeLabel(battle.flow_type)}
                          </td>
                        ) : null}
                        {!isMobile ? (
                          <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                            {battleStatusLabel(battle.status)}
                          </td>
                        ) : null}
                        {!isMobile ? (
                          <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                            <span className="block max-w-[260px] truncate">{participantSummary}</span>
                          </td>
                        ) : null}
                        {!isMobile ? (
                          <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                            {formatCreatedAt(battle.created_at)}
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-right align-middle sm:px-4 sm:py-3">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-[0.58rem]"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCancelTarget(battleEntry);
                              setCancelError("");
                            }}
                          >
                            Cancel
                          </Button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td
                            colSpan={columnCount}
                            className="border-b border-border/40 bg-background/20 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3"
                          >
                            <div className="space-y-3">
                              {isMobile ? (
                                <div className="grid gap-2 text-xs text-muted-foreground">
                                  <p>
                                    <span className="font-semibold text-foreground">Type:</span>{" "}
                                    {battleTypeLabel(battle.flow_type)}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-foreground">Status:</span>{" "}
                                    {battleStatusLabel(battle.status)}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-foreground">Created:</span>{" "}
                                    {formatCreatedAt(battle.created_at)}
                                  </p>
                                </div>
                              ) : null}
                              <div className="space-y-2">
                                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                                  Participants
                                </p>
                                <div className="grid gap-2">
                                  {battleEntry.participants.map((participant) => (
                                    <div
                                      key={participant.id}
                                      className="rounded-xl border border-border/50 bg-black/20 px-3 py-2"
                                    >
                                      <p className="text-sm font-semibold text-foreground">
                                        {participant.user.label}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {participant.warband.name} • {participantStatusLabel(participant.status)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
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

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeCancelDialog();
          }
        }}
        description={
          <div className="space-y-2">
            <p>
              Cancel{" "}
              <span className="font-semibold text-foreground">
                {cancelTarget?.battle.scenario || "this battle"}
              </span>{" "}
              for all participants?
            </p>
            {cancelError ? <p className="text-sm text-red-600">{cancelError}</p> : null}
          </div>
        }
        confirmText={isCanceling ? "Canceling..." : "Confirm cancel"}
        confirmVariant="destructive"
        confirmDisabled={isCanceling || !cancelTarget}
        isConfirming={isCanceling}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={closeCancelDialog}
      />
    </section>
  );
}
