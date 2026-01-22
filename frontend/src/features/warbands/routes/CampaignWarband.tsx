import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { useAuth } from "../../auth/hooks/use-auth";
import { listItems } from "../../items/api/items-api";
import { listSkills } from "../../skills/api/skills-api";
import {
  createWarband,
  createWarbandHero,
  deleteWarbandHero,
  getWarband,
  listWarbandHeroes,
  updateWarbandHero,
} from "../api/warbands-api";
import CreateWarbandDialog from "../components/CreateWarbandDialog";
import HeroFormCard from "../components/HeroFormCard";
import HeroSummaryCard from "../components/HeroSummaryCard";
import type {
  HeroFormEntry,
  Warband,
  WarbandCreatePayload,
  WarbandHero,
} from "../types/warband-types";
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";

const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
const skillFields = [
  { key: "C", label: "C" },
  { key: "Sh", label: "Sh" },
  { key: "A", label: "A" },
  { key: "St", label: "St" },
  { key: "Spc", label: "Spc" },
] as const;

const emptyHeroForm = (): HeroFormEntry => ({
  name: "",
  unit_type: "",
  race: "",
  stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
  experience: "",
  hire_cost: "",
  available_skills: skillFields.reduce((acc, field) => ({ ...acc, [field.key]: false }), {}),
  items: [],
  skills: [],
});

const mapHeroToForm = (hero: WarbandHero): HeroFormEntry => ({
  id: hero.id,
  name: hero.name ?? "",
  unit_type: hero.unit_type ?? "",
  race: hero.race ?? "",
  stats: statFields.reduce(
    (acc, key) => ({ ...acc, [key]: hero.stats?.[key] ?? "" }),
    {}
  ),
  experience: hero.experience?.toString() ?? "",
  hire_cost: hero.hire_cost?.toString() ?? "",
  available_skills: skillFields.reduce(
    (acc, field) => ({ ...acc, [field.key]: Boolean(hero.available_skills?.[field.key]) }),
    {}
  ),
  items: hero.items ?? [],
  skills: hero.skills ?? [],
});

const hasHeroContent = (hero: HeroFormEntry) => {
  if (hero.name.trim() || hero.unit_type.trim() || hero.race.trim()) {
    return true;
  }
  if (hero.experience.trim() || hero.hire_cost.trim()) {
    return true;
  }
  if (Object.values(hero.stats).some((value) => String(value).trim())) {
    return true;
  }
  if (Object.values(hero.available_skills).some(Boolean)) {
    return true;
  }
  if (hero.items.length > 0) {
    return true;
  }
  if (hero.skills.length > 0) {
    return true;
  }
  return false;
};

export default function CampaignWarband() {
  const { id } = useParams();
  const { token, isReady } = useAuth();
  const [warband, setWarband] = useState<Warband | null>(null);
  const [heroes, setHeroes] = useState<WarbandHero[]>([]);
  const [heroForms, setHeroForms] = useState<HeroFormEntry[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [itemsError, setItemsError] = useState("");
  const [skillsError, setSkillsError] = useState("");
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [removedHeroIds, setRemovedHeroIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const campaignId = useMemo(() => Number(id), [id]);

  const loadWarband = useCallback(async () => {
    if (!token || !id) {
      return;
    }

    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await getWarband(token, campaignId);
      setWarband(data);
      if (data) {
        const heroData = await listWarbandHeroes(token, data.id);
        setHeroes(heroData);
      } else {
        setHeroes([]);
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load warband");
      } else {
        setError("Unable to load warband");
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, id, campaignId]);

  const loadItems = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsItemsLoading(true);
    setItemsError("");

    try {
      const data = await listItems(token);
      setAvailableItems(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setItemsError(errorResponse.message || "Unable to load items");
      } else {
        setItemsError("Unable to load items");
      }
    } finally {
      setIsItemsLoading(false);
    }
  }, [token]);

  const loadSkills = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsSkillsLoading(true);
    setSkillsError("");

    try {
      const data = await listSkills(token);
      setAvailableSkills(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSkillsError(errorResponse.message || "Unable to load skills");
      } else {
        setSkillsError("Unable to load skills");
      }
    } finally {
      setIsSkillsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isReady && token) {
      loadWarband();
      loadItems();
      loadSkills();
    }
  }, [isReady, token, loadWarband, loadItems, loadSkills]);

  const handleCreate = async (payload: WarbandCreatePayload) => {
    if (!token || !id) {
      return;
    }

    if (Number.isNaN(campaignId)) {
      return;
    }

    const created = await createWarband(token, campaignId, payload);
    setWarband(created);
    setHeroes([]);
    setIsEditing(false);
    setSaveMessage("");
    setSaveError("");
  };

  const handleToggleEdit = () => {
    setSaveMessage("");
    setSaveError("");

    if (!isEditing) {
      const forms = heroes.map(mapHeroToForm);
      setHeroForms(forms.length ? forms : [emptyHeroForm()]);
      setRemovedHeroIds([]);
    } else {
      setHeroForms([]);
      setRemovedHeroIds([]);
    }

    setIsEditing((prev) => !prev);
  };

  const updateHeroForm = (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => {
    setHeroForms((prev) => prev.map((hero, idx) => (idx === index ? updater(hero) : hero)));
  };

  const handleRemoveHero = (index: number) => {
    setHeroForms((prev) => {
      const hero = prev[index];
      if (hero?.id) {
        setRemovedHeroIds((current) => [...current, hero.id as number]);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleAddHero = () => {
    setHeroForms((prev) => (prev.length >= 6 ? prev : [...prev, emptyHeroForm()]));
  };

  const handleSaveHeroes = async () => {
    if (!token || !warband) {
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const createPromises = heroForms
        .filter((hero) => !hero.id && hasHeroContent(hero))
        .map((hero) =>
          createWarbandHero(token, warband.id, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race.trim() || null,
            stats: Object.keys(hero.stats).reduce((acc, key) => {
              const value = hero.stats[key];
              if (String(value).trim()) {
                return { ...acc, [key]: value };
              }
              return acc;
            }, {} as Record<string, string>),
            experience: hero.experience.trim() ? Number(hero.experience) : null,
            hire_cost: hero.hire_cost.trim() ? Number(hero.hire_cost) : null,
            available_skills: Object.keys(hero.available_skills).reduce((acc, key) => {
              if (hero.available_skills[key]) {
                return { ...acc, [key]: true };
              }
              return acc;
            }, {} as Record<string, boolean>),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
          })
        );

      const updatePromises = heroForms
        .filter((hero) => hero.id)
        .map((hero) =>
          updateWarbandHero(token, warband.id, hero.id as number, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race.trim() || null,
            stats: Object.keys(hero.stats).reduce((acc, key) => {
              const value = hero.stats[key];
              if (String(value).trim()) {
                return { ...acc, [key]: value };
              }
              return acc;
            }, {} as Record<string, string>),
            experience: hero.experience.trim() ? Number(hero.experience) : null,
            hire_cost: hero.hire_cost.trim() ? Number(hero.hire_cost) : null,
            available_skills: Object.keys(hero.available_skills).reduce((acc, key) => {
              if (hero.available_skills[key]) {
                return { ...acc, [key]: true };
              }
              return acc;
            }, {} as Record<string, boolean>),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
          })
        );

      const deletePromises = removedHeroIds.map((heroId) =>
        deleteWarbandHero(token, warband.id, heroId)
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

      const refreshed = await listWarbandHeroes(token, warband.id);
      setHeroes(refreshed);
      setHeroForms([]);
      setRemovedHeroIds([]);
      setIsEditing(false);
      setSaveMessage("Heroes updated.");
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to update heroes");
      } else {
        setSaveError("Unable to update heroes");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {warband ? (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              {warband.faction}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">{warband.name}</h1>
            <p className="mt-2 text-muted-foreground">Roster, scars, and spoils recorded here.</p>
          </div>
          <div className="flex items-center gap-3">
            {saveMessage ? <span className="text-sm text-emerald-700">{saveMessage}</span> : null}
            <Button variant="outline" onClick={handleToggleEdit}>
              {isEditing ? "Stop editing" : "Edit heroes"}
            </Button>
          </div>
        </header>
      ) : (
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Warband
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Raise your banner</h1>
          <p className="mt-2 text-muted-foreground">
            Raise your banner and choose a faction to begin the hunt.
          </p>
        </header>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Scanning the roster...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !warband ? (
        <Card className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No warband logged for this campaign yet.
            </p>
            <CreateWarbandDialog onCreate={handleCreate} />
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Heroes</CardTitle>
              <CardDescription>Leaders and champions who earn their scars.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isItemsLoading ? (
                <p className="text-xs text-muted-foreground">Loading items...</p>
              ) : null}
              {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
              {isSkillsLoading ? (
                <p className="text-xs text-muted-foreground">Loading skills...</p>
              ) : null}
              {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
              {isEditing ? (
                <div className="space-y-5">
                  {heroForms.map((hero, index) => (
                    <HeroFormCard
                      key={hero.id ?? `new-${index}`}
                      hero={hero}
                      index={index}
                      statFields={statFields}
                      skillFields={skillFields}
                      availableItems={availableItems}
                      availableSkills={availableSkills}
                      onUpdate={updateHeroForm}
                      onRemove={handleRemoveHero}
                    />
                  ))}

                  {heroForms.length < 6 ? (
                    <Button type="button" variant="secondary" onClick={handleAddHero}>
                      + Add hero
                    </Button>
                  ) : null}

                  {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveHeroes} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save heroes"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleToggleEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : heroes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No heroes logged yet. Start with your leader and key champions.
                </p>
              ) : (
                <div className="space-y-3">
                  {heroes.map((hero) => (
                    <HeroSummaryCard key={hero.id} hero={hero} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
