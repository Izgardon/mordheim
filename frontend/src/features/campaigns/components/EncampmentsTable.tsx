import { Fragment, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { ImageScrollArea } from "@components/image-scroll-area";

import type { CampaignEncampment } from "../types/campaign-types";

type EncampmentsTableProps = {
  encampments: CampaignEncampment[];
  rowBackground: CSSProperties;
  renderActions: (encampment: CampaignEncampment) => ReactNode;
  isMobile?: boolean;
};

function renderOwner(encampment: CampaignEncampment) {
  return encampment.owner_name?.trim() || "Unassigned";
}

export default function EncampmentsTable({
  encampments,
  rowBackground,
  renderActions,
  isMobile,
}: EncampmentsTableProps) {
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const toggle = (id: number) =>
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));

  if (isMobile) {
    return (
      <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0" showScrollbar={false}>
        <table className="min-w-full table-fixed divide-y border border-border/60 text-xs">
          <thead className="table-head-surface border-b border-border/60 text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-semibold">
                <span className="sr-only">Expand</span>
              </th>
              <th className="px-2 py-2 text-left font-semibold">Name</th>
              <th className="w-[30%] px-2 py-2 text-left font-semibold">Owner</th>
              <th className="w-[22%] px-2 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 border-b border-border/60">
            {encampments.map((encampment, index) => {
              const isExpanded = expandedIds.includes(encampment.id);
              return (
                <Fragment key={encampment.id}>
                  <tr
                    className={[
                      "cursor-pointer transition-colors",
                      index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover",
                    ].join(" ")}
                    style={rowBackground}
                    onClick={() => toggle(encampment.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggle(encampment.id);
                      }
                    }}
                  >
                    <td className="px-2 py-2">
                      <ChevronDown
                        className={[
                          "h-4 w-4 transition-transform",
                          isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </td>
                    <td className="px-2 py-2 font-medium text-foreground">{encampment.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{renderOwner(encampment)}</td>
                    <td className="px-2 py-2 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      {renderActions(encampment)}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-background/50">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex flex-col gap-2 text-sm">
                          <div className="flex gap-2">
                            <span className="w-16 shrink-0 text-xs text-muted-foreground">Owner</span>
                            <span className="text-foreground/90">{renderOwner(encampment)}</span>
                          </div>
                          <p className="text-foreground/90 whitespace-pre-line">
                            {encampment.description?.trim() || "No description yet."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </ImageScrollArea>
    );
  }

  return (
    <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0" showScrollbar={false}>
      <table className="min-w-full table-fixed divide-y border border-border/60 text-sm">
        <thead className="table-head-surface border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <tr>
            <th className="w-[28%] px-4 py-3 text-left font-semibold">Name</th>
            <th className="w-[20%] px-4 py-3 text-left font-semibold">Owner</th>
            <th className="w-[42%] px-4 py-3 text-left font-semibold">Description</th>
            <th className="w-[10%] px-4 py-3 text-left font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 border-b border-border/60">
          {encampments.map((encampment, index) => (
            <tr
              key={encampment.id}
              className={[
                "transition-colors",
                index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover",
              ].join(" ")}
              style={rowBackground}
            >
              <td className="px-4 py-3 font-medium text-foreground">{encampment.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{renderOwner(encampment)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {encampment.description?.trim() || "-"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{renderActions(encampment)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ImageScrollArea>
  );
}
