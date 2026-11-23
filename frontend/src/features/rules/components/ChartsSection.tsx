import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { ReferenceList } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useState } from "react";

import { chartRowKey, chartRowSub, chartRowWords, chartRows } from "../campaign-rule-rows";
import { movedIds } from "../hooks/useCampaignRuleWrites";
import type { useCampaignChartWrites } from "../hooks/useCampaignChartWrites";
import type { CampaignChart } from "../types/rule-types";
import CampaignChartDialog from "./CampaignChartDialog";
import CampaignChartsModal from "./CampaignChartsModal";
import RuleOpenRow from "./RuleOpenRow";

/**
 * The campaign's charts on the Campaign rules page (William, 19 Nov 2026: "Charts should just have
 * a title description and chart"). Each row opens a modal; charts sharing an umbrella are one row
 * that opens them together.
 */
export default function ChartsSection({
  charts,
  loading,
  query,
  canManage,
  writes,
  openKey,
  onOpen,
  onClose,
  isMobile,
}: {
  charts: CampaignChart[];
  loading: boolean;
  query: string;
  canManage: boolean;
  writes: ReturnType<typeof useCampaignChartWrites>;
  openKey: string | null;
  onOpen: (key: string) => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  const [error, setError] = useState("");
  const all = chartRows(charts);
  const shown = all.filter(
    (row) => row.key === openKey || matchesSearchQuery(query, ...chartRowWords(row))
  );
  const open = all.find((row) => row.key === openKey) ?? null;
  const move = (chartId: number, by: -1 | 1) =>
    writes.reorder.mutate(movedIds(charts, chartId, by), {
      onError: (failure) => setError(getErrorMessage(failure, "Couldn't move the table.")),
    });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Tables</SectionTitle>
        {canManage ? (
          <CampaignChartDialog
            writes={writes}
            onSaved={(chart) => onOpen(chartRowKey(chart))}
            trigger={
              <Button size="sm" variant="secondary">
                {isMobile ? "Add" : "Add table"}
              </Button>
            }
          />
        ) : null}
      </div>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
      <ReferenceList
        isEmpty={!loading && shown.length === 0}
        empty={all.length ? "No tables match." : "No tables yet."}
      >
        {loading ? <ReferenceRowBones /> : null}
        {shown.map((row) => (
          <RuleOpenRow
            key={row.key}
            name={row.name}
            sub={chartRowSub(row)}
            onOpen={() => onOpen(row.key)}
          />
        ))}
      </ReferenceList>
      <CampaignChartsModal
        row={open}
        onClose={onClose}
        actions={
          canManage
            ? (chartId) => {
                const chart = charts.find((entry) => entry.id === chartId);
                const place = charts.findIndex((entry) => entry.id === chartId);
                if (!chart) return null;
                return (
                  <>
                    <CampaignChartDialog
                      chart={chart}
                      writes={writes}
                      onDeleted={onClose}
                      trigger={
                        <Button variant="secondary" className="min-h-10">
                          Edit
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      className="min-h-10"
                      disabled={place <= 0 || writes.reorder.isPending}
                      onClick={() => move(chartId, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-10"
                      disabled={place >= charts.length - 1 || writes.reorder.isPending}
                      onClick={() => move(chartId, 1)}
                    >
                      Move down
                    </Button>
                  </>
                );
              }
            : undefined
        }
      />
    </section>
  );
}
