import { useEffect, useState } from "react";

import { getSpecial } from "../../../../special/api/special-api";
import { getItem, listItemProperties } from "../../../../items/api/items-api";
import { getSkill } from "../../../../skills/api/skills-api";
import { getSpell } from "../../../../spells/api/spells-api";

import type { Special } from "../../../../special/types/special-types";
import type { Item, ItemProperty } from "../../../../items/types/item-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { DetailEntry } from "./detail-types";

import { Tooltip } from "@components/tooltip";

type DetailCardContentProps = {
  entry: DetailEntry;
};

export default function DetailCardContent({ entry }: DetailCardContentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemData, setItemData] = useState<Item | null>(null);
  const [itemPropertyMap, setItemPropertyMap] = useState<Record<number, ItemProperty>>({});
  const [skillData, setSkillData] = useState<Skill | null>(null);
  const [spellData, setSpellData] = useState<Spell | null>(null);
  const [specialData, setSpecialData] = useState<Special | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setItemData(null);
      setSkillData(null);
      setSpellData(null);
      setSpecialData(null);

      try {
        if (entry.type === "item") {
          const data = await getItem(entry.id);
          setItemData(data);
        } else if (entry.type === "skill") {
          const data = await getSkill(entry.id);
          setSkillData(data);
        } else if (entry.type === "spell") {
          const data = await getSpell(entry.id);
          setSpellData(data);
        } else if (entry.type === "special") {
          const data = await getSpecial(entry.id);
          setSpecialData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [entry.id, entry.type]);

  useEffect(() => {
    if (!itemData?.type) {
      setItemPropertyMap({});
      return;
    }

    listItemProperties({
      type: itemData.type,
      campaignId: itemData.campaign_id ?? undefined,
    })
      .then((properties) => {
        const mapped = properties.reduce<Record<number, ItemProperty>>((acc, property) => {
          acc[property.id] = property;
          return acc;
        }, {});
        setItemPropertyMap(mapped);
      })
      .catch(() => setItemPropertyMap({}));
  }, [itemData?.type, itemData?.campaign_id]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  switch (entry.type) {
    case "item": {
      const item = itemData;
      if (!item) return null;
      return (
        <>
          <div className="mb-4 pr-8">
            <h3 className="text-lg font-bold text-foreground">{item.name}</h3>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {item.type}{item.subtype ? ` - ${item.subtype}` : ""}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {item.cost !== undefined && item.cost !== null && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Cost</span>
                  <span className="font-semibold">{item.cost} gc</span>
                </div>
              )}
              {item.availabilities?.length > 0 && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Rarity</span>
                  <span className="font-semibold">
                    {item.availabilities.map((a) => (a.rarity === 2 ? "Common" : a.rarity)).join(" / ")}
                  </span>
                </div>
              )}
              {item.strength && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Strength</span>
                  <span className="font-semibold">{item.strength}</span>
                </div>
              )}
              {item.range && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Range</span>
                  <span className="font-semibold">{item.range}</span>
                </div>
              )}
              {item.save && (
                <div className="flex flex-col gap-0.5 border border-primary/20 bg-background/50 px-3 py-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Save</span>
                  <span className="font-semibold">{item.save}</span>
                </div>
              )}
            </div>
            {item.properties && item.properties.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Properties</span>
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
                        itemPropertyMap[prop.id]?.description?.trim()
                          ? itemPropertyMap[prop.id].description
                          : "No description available yet."
                      }
                      className="inline-flex"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      );
    }
    case "skill": {
      const skill = skillData;
      if (!skill) return null;
      return (
        <>
          <div className="mb-4 pr-8">
            <h3 className="text-lg font-bold text-foreground">{skill.name}</h3>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{skill.type}</span>
          </div>
          {skill.description ? (
            <p className="text-sm leading-relaxed text-foreground">{skill.description}</p>
          ) : null}
        </>
      );
    }
    case "spell": {
      const spell = spellData;
      if (!spell) return null;
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
      const special = specialData;
      if (!special) return null;
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
