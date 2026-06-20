import { Fragment, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { ImageScrollArea } from "@components/image-scroll-area";

import type { CampaignLocation } from "../types/campaign-types";

const d6FieldOrder = ["d6_1", "d6_2", "d6_3", "d6_4", "d6_5", "d6_6"] as const;

type LocationsTableProps = {
  locations: CampaignLocation[];
  rowBackground: CSSProperties;
  renderActions: (location: CampaignLocation) => ReactNode;
  isMobile?: boolean;
};

function getD6Rows(location: CampaignLocation) {
  return d6FieldOrder
    .map((fieldName, index) => ({
      roll: index + 1,
      value: location[fieldName],
    }))
    .filter((entry) => entry.value?.trim());
}

function getContentPreview(location: CampaignLocation) {
  const raw = location.content || "";
  const withoutTags = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!withoutTags) {
    return "-";
  }
  return withoutTags.length > 120 ? `${withoutTags.slice(0, 117)}...` : withoutTags;
}

function ExpandedLocationContent({ location }: { location: CampaignLocation }) {
  const rows = useMemo(() => getD6Rows(location), [location]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Main Content</p>
        {location.content?.trim() ? (
          <div
            className="prose prose-invert max-w-none text-sm text-foreground/90"
            dangerouslySetInnerHTML={{ __html: location.content }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No main location text yet.</p>
        )}
      </div>
      {rows.length ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">D6 Results</p>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/35">
            <table className="min-w-full text-sm">
              <thead className="bg-background/60 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.roll} className="border-t border-border/50 align-top">
                    <td className="px-3 py-2 font-semibold text-foreground">{entry.roll}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-pre-wrap">{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LocationsTable({
  locations,
  rowBackground,
  renderActions,
  isMobile,
}: LocationsTableProps) {
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
              <th className="w-[22%] px-2 py-2 text-left font-semibold">D6</th>
              <th className="w-[22%] px-2 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 border-b border-border/60">
            {locations.map((location, index) => {
              const isExpanded = expandedIds.includes(location.id);
              const resultCount = getD6Rows(location).length;
              return (
                <Fragment key={location.id}>
                  <tr
                    className={[
                      "cursor-pointer transition-colors",
                      index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover",
                    ].join(" ")}
                    style={rowBackground}
                    onClick={() => toggle(location.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggle(location.id);
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
                    <td className="px-2 py-2 font-medium text-foreground">{location.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{resultCount || "-"}</td>
                    <td className="px-2 py-2 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      {renderActions(location)}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-background/50">
                      <td colSpan={4} className="px-4 py-3">
                        <ExpandedLocationContent location={location} />
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
      <table className="min-w-full table-fixed border border-border/60 text-sm">
        <thead className="table-head-surface sticky top-0 z-10 border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <tr>
            <th className="w-10 px-4 py-3 text-left font-semibold">
              <span className="sr-only">Expand</span>
            </th>
            <th className="w-[24%] px-4 py-3 text-left font-semibold">Name</th>
            <th className="w-[48%] px-4 py-3 text-left font-semibold">Content</th>
            <th className="w-[10%] px-4 py-3 text-left font-semibold">D6</th>
            <th className="w-[18%] px-4 py-3 text-left font-semibold"></th>
          </tr>
        </thead>
        <tbody className="border-b border-border/60">
          {locations.map((location, index) => {
            const isExpanded = expandedIds.includes(location.id);
            const resultCount = getD6Rows(location).length;

            return (
              <Fragment key={location.id}>
                <tr
                  className={[
                    "cursor-pointer border-t border-border/60 transition-colors",
                    index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover",
                  ].join(" ")}
                  style={rowBackground}
                  onClick={() => toggle(location.id)}
                  role="button"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle(location.id);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <ChevronDown
                      className={[
                        "h-4 w-4 transition-transform",
                        isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{location.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getContentPreview(location)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{resultCount || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                    {renderActions(location)}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-t border-border/60 bg-background/50">
                    <td colSpan={5} className="px-4 py-4 text-sm text-foreground/90">
                      <ExpandedLocationContent location={location} />
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
