import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { useCatalogue } from "@/lib/catalogue-queries";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDetailEntry } from "../../../hooks/shared/useDetailEntry";

import type { Special } from "../../../../special/types/special-types";
import type { Item } from "../../../../items/types/item-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { DetailEntry } from "./detail-types";

import { ErrorState } from "@components/error-state";
import { Tooltip } from "@components/tooltip";

type DetailCardContentProps = {
  entry: DetailEntry;
};

/**
 * An item, skill, spell or special in a popup or tooltip. The entry and an item's property text
 * come from the campaign's cached lists where they hold them, read side by side otherwise, and a
 * failed read says so with Retry (CAT-UX-04, CAT-PERF-03).
 */
export default function DetailCardContent({ entry }: DetailCardContentProps) {
  const campaignId = Number(useParams().id);
  const detail = useDetailEntry(entry, campaignId);
  const properties = useCatalogue("item-properties", campaignId, {
    enabled: entry.type === "item",
  });
  const itemPropertyMap = useMemo(
    () => new Map(properties.data.map((property) => [property.id, property])),
    [properties.data]
  );

  if (detail.data === undefined) {
    return detail.isError ? (
      <ErrorState
        message={getErrorMessage(detail.error, "Couldn't load the details.")}
        onRetry={() => void detail.refetch()}
        className="px-0 py-2"
      />
    ) : (
      <p className="text-sm text-muted-foreground">Loading...</p>
    );
  }

  switch (entry.type) {
    case "item": {
      const item = detail.data as Item;
      return (
        <>
          <div className="mb-4 pr-8">
            <h3 className="text-lg font-bold text-foreground">{item.name}</h3>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {item.type}
              {item.subtype ? ` - ${item.subtype}` : ""}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {item.cost !== undefined && item.cost !== null && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Cost
                  </span>
                  <span className="font-semibold">{item.cost} gc</span>
                </div>
              )}
              {item.availabilities?.length > 0 && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Rarity
                  </span>
                  <span className="font-semibold">
                    {item.availabilities
                      .map((a) => (a.rarity === 2 ? "Common" : a.rarity))
                      .join(" / ")}
                  </span>
                </div>
              )}
              {item.strength && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Strength
                  </span>
                  <span className="font-semibold">{item.strength}</span>
                </div>
              )}
              {item.range && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Range
                  </span>
                  <span className="font-semibold">{item.range}</span>
                </div>
              )}
              {item.save && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Save
                  </span>
                  <span className="font-semibold">{item.save}</span>
                </div>
              )}
            </div>
            {item.properties && item.properties.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Properties
                </span>
                <div className="flex flex-wrap gap-2">
                  {item.properties.map((prop) => (
                    <Tooltip
                      key={prop.id}
                      trigger={
                        <span className="cursor-help border border-primary/30 bg-primary/20 px-2 py-1 text-sm underline decoration-dotted underline-offset-2">
                          {prop.name}
                        </span>
                      }
                      content={
                        itemPropertyMap.get(prop.id)?.description?.trim() ||
                        "No description available yet."
                      }
                      className="inline-flex"
                    />
                  ))}
                </div>
                {properties.error ? (
                  <ErrorState
                    message="Couldn't load the property descriptions."
                    onRetry={() => void properties.refetch()}
                    className="items-start px-0 py-0 text-left"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      );
    }
    case "skill": {
      const skill = detail.data as Skill;
      return (
        <>
          <div className="mb-4 pr-8">
            <h3 className="text-lg font-bold text-foreground">{skill.name}</h3>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {skill.type}
            </span>
          </div>
          {skill.description ? (
            <p className="text-sm leading-relaxed text-foreground">{skill.description}</p>
          ) : null}
        </>
      );
    }
    case "spell": {
      const spell = detail.data as Spell;
      const displayName = entry.name || spell.name;
      const displayDc = entry.dc ?? spell.dc;
      return (
        <>
          <div className="mb-4 pr-8">
            <h3 className="text-lg font-bold text-foreground">{displayName}</h3>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {spell.type || "Spell"}
              </span>
              {displayDc !== undefined && displayDc !== null && displayDc !== "" ? (
                <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  DC {displayDc}
                </span>
              ) : null}
            </div>
          </div>
          {spell.description ? (
            <p className="text-sm leading-relaxed text-foreground">{spell.description}</p>
          ) : null}
        </>
      );
    }
    case "special": {
      const special = detail.data as Special;
      return (
        <>
          <div className="mb-4 pr-8">
            <h3 className="text-lg font-bold text-foreground">{special.name}</h3>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {special.type || "Special"}
            </span>
          </div>
          {special.description ? (
            <p className="text-sm leading-relaxed text-foreground">{special.description}</p>
          ) : null}
        </>
      );
    }
  }
}
