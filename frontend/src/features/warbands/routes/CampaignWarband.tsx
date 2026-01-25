import { useCallback, useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

import "../styles/warband.css";

// components
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import TabbedCard from "../../../components/ui/tabbed-card";
import { ActionSearchInput } from "../../../components/ui/action-search-input";
import CreateWarbandDialog from "../components/CreateWarbandDialog";
import HeroFormCard from "../components/HeroFormCard";
import HeroSummaryCard from "../components/HeroSummaryCard";
import CreateRaceDialog from "../../races/components/CreateRaceDialog";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";

// api
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";
import { listItems } from "../../items/api/items-api";
import { listRaces } from "../../races/api/races-api";
import { listSkills } from "../../skills/api/skills-api";
import {
  createWarband,
  createWarbandHero,
  deleteWarbandHero,
  getWarband,
  getWarbandById,
  listWarbandHeroes,
  updateWarband,
  updateWarbandHero,
} from "../api/warbands-api";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { Item } from "../../items/types/item-types";
import type { Race } from "../../races/types/race-types";
import type { Skill } from "../../skills/types/skill-types";
import type {
  HeroFormEntry,
  Warband,
  WarbandCreatePayload,
  WarbandHero,
  WarbandUpdatePayload,
} from "../types/warband-types";

const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
const skillFields = [
  { key: "C", label: "C" },
  { key: "Sh", label: "Sh" },
  { key: "A", label: "A" },
  { key: "St", label: "St" },
  { key: "Spc", label: "Spc" },
] as const;

const statFieldMap = {
  M: "movement",
  WS: "weapon_skill",
  BS: "ballistic_skill",
  S: "strength",
  T: "toughness",
  W: "wounds",
  I: "initiative",
  A: "attacks",
  Ld: "leadership",
} as const;

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) {
      return 0;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toNullableNumber = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

type NewHeroForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  price: string;
  xp: string;
};

const mapHeroToForm = (hero: WarbandHero): HeroFormEntry => ({
  id: hero.id,
  name: hero.name ?? "",
  unit_type: hero.unit_type ?? "",
  race_id: hero.race_id ?? null,
  race_name: hero.race_name ?? "",
  stats: statFields.reduce(
    (acc, key) => {
      const statKey = statFieldMap[key];
      const value = hero[statKey as keyof WarbandHero];
      return {
        ...acc,
        [key]: value !== null && value !== undefined ? String(value) : "",
      };
    },
    {}
  ),
  xp: hero.xp?.toString() ?? "0",
  price: hero.price?.toString() ?? "0",
  armour_save: hero.armour_save ?? "",
  available_skills: skillFields.reduce(
    (acc, field) => ({ ...acc, [field.key]: Boolean(hero.available_skills?.[field.key]) }),
    {}
  ),
  items: hero.items ?? [],
  skills: hero.skills ?? [],
});

type WarbandTab = "warband" | "info";

export default function CampaignWarband() {
  const { id, warbandId } = useParams();
  const { user } = useAuth();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [warband, setWarband] = useState<Warband | null>(null);
  const [heroes, setHeroes] = useState<WarbandHero[]>([]);
  const [heroForms, setHeroForms] = useState<HeroFormEntry[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [availableRaces, setAvailableRaces] = useState<Race[]>([]);
  const [itemsError, setItemsError] = useState("");
  const [skillsError, setSkillsError] = useState("");
  const [racesError, setRacesError] = useState("");
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [isRacesLoading, setIsRacesLoading] = useState(false);
  const [removedHeroIds, setRemovedHeroIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<WarbandTab>("warband");
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({
    name: "",
    faction: "",
  });
  const [expandedHeroId, setExpandedHeroId] = useState<number | null>(null);
  const [newHeroForm, setNewHeroForm] = useState<NewHeroForm>({
    name: "",
    unit_type: "",
    race_id: null,
    race_name: "",
    price: "0",
    xp: "0",
  });
  const [isAddingHeroForm, setIsAddingHeroForm] = useState(false);
  const [newHeroError, setNewHeroError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);

  const campaignId = useMemo(() => Number(id), [id]);
  const resolvedWarbandId = useMemo(() => (warbandId ? Number(warbandId) : null), [warbandId]);
  const isViewingOther = resolvedWarbandId !== null;
  const warbandResources = warband?.resources ?? [];
  const isHeroLimitReached = heroForms.length >= 6;

  const { goldCrowns, otherResources } = useMemo(() => {
    const goldIndex = warbandResources.findIndex(
      (resource) => resource.name.trim().toLowerCase() === "gold crowns"
    );
    const goldResource = goldIndex >= 0 ? warbandResources[goldIndex] : null;
    const filtered = goldResource
      ? warbandResources.filter((_, index) => index !== goldIndex)
      : warbandResources;
    return {
      goldCrowns: goldResource?.amount ?? 0,
      otherResources: filtered,
    };
  }, [warbandResources]);

  const matchingRaces = useMemo(() => {
    const query = raceQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return availableRaces
      .filter((race) => race.id !== newHeroForm.race_id)
      .filter((race) => race.name.toLowerCase().includes(query));
  }, [availableRaces, newHeroForm.race_id, raceQuery]);

  const warbandRating = useMemo(() => {
    if (typeof warband?.rating === "number") {
      return warband.rating;
    }
    return heroes.reduce((total, hero) => {
      const base = hero.large ? 20 : 5;
      const xp = toNumber(hero.xp);
      return total + base + xp;
    }, 0);
  }, [heroes, warband?.rating]);

  const loadWarband = useCallback(async () => {
    if (!id) {
      return;
    }

    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    if (resolvedWarbandId !== null && Number.isNaN(resolvedWarbandId)) {
      setError("Invalid warband id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data =
        resolvedWarbandId !== null
          ? await getWarbandById(resolvedWarbandId)
          : await getWarband(campaignId);
      setWarband(data);
      if (data) {
        const heroData = await listWarbandHeroes(data.id);
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
  }, [id, campaignId, resolvedWarbandId]);

  const loadItems = useCallback(async () => {
    setIsItemsLoading(true);
    setItemsError("");

    try {
      const data = await listItems({ campaignId });
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
  }, [campaignId]);

  const loadSkills = useCallback(async () => {
    setIsSkillsLoading(true);
    setSkillsError("");

    try {
      const data = await listSkills({ campaignId });
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
  }, [campaignId]);

  const loadRaces = useCallback(async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }
    setIsRacesLoading(true);
    setRacesError("");

    try {
      const data = await listRaces({ campaignId });
      setAvailableRaces(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setRacesError(errorResponse.message || "Unable to load races");
      } else {
        setRacesError("Unable to load races");
      }
    } finally {
      setIsRacesLoading(false);
    }
  }, [campaignId]);

  const loadMemberPermissions = useCallback(async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }
    if (!campaign || campaign.role !== "player") {
      return;
    }
    try {
      const permissions = await listMyCampaignPermissions(campaignId);
      setMemberPermissions(permissions.map((permission) => permission.code));
    } catch {
      setMemberPermissions([]);
    }
  }, [campaign, campaignId]);

  const handleRaceCreated = useCallback((race: Race) => {
    setAvailableRaces((prev) =>
      prev.some((existing) => existing.id === race.id) ? prev : [race, ...prev]
    );
  }, []);

  useEffect(() => {
    loadWarband();
    loadItems();
    loadSkills();
    loadRaces();
    loadMemberPermissions();
  }, [loadWarband, loadItems, loadSkills, loadRaces, loadMemberPermissions]);

  useEffect(() => {
    if (warband && !isEditing) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  }, [warband, isEditing]);

  const isWarbandOwner = Boolean(warband && user && warband.user_id === user.id);
  const canEdit =
    Boolean(warband) &&
    (isWarbandOwner ||
      campaign?.role === "owner" ||
      campaign?.role === "admin" ||
      memberPermissions.includes("manage_warbands"));

  const handleCreate = async (payload: WarbandCreatePayload) => {
    if (!id) {
      return;
    }

    if (Number.isNaN(campaignId) || isViewingOther) {
      return;
    }

    const created = await createWarband(campaignId, payload);
    setWarband(created);
    setHeroes([]);
    setIsEditing(false);
    setSaveMessage("");
    setSaveError("");
    setWarbandForm({ name: created.name, faction: created.faction });
  };

  const startEditing = () => {
    if (!canEdit || !warband) {
      return;
    }

    setSaveMessage("");
    setSaveError("");
    setWarbandForm({ name: warband.name, faction: warband.faction });

    const forms = heroes.map(mapHeroToForm);
    setHeroForms(forms);
    setRemovedHeroIds([]);
    setNewHeroForm({
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      price: "0",
      xp: "0",
    });
    setIsAddingHeroForm(false);
    setNewHeroError("");
    setRaceQuery("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setHeroForms([]);
    setRemovedHeroIds([]);
    setSaveMessage("");
    setSaveError("");
    setNewHeroForm({
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      price: "0",
      xp: "0",
    });
    setIsAddingHeroForm(false);
    setNewHeroError("");
    setRaceQuery("");
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  };

  const updateHeroForm = (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => {
    setHeroForms((prev) => prev.map((hero, idx) => (idx === index ? updater(hero) : hero)));
  };

  const handleItemCreated = (index: number, item: Item) => {
    setAvailableItems((prev) =>
      prev.some((existing) => existing.id === item.id) ? prev : [item, ...prev]
    );
    updateHeroForm(index, (current) => {
      if (current.items.some((existing) => existing.id === item.id)) {
        return current;
      }
      if (current.items.length >= 6) {
        return current;
      }
      return { ...current, items: [...current.items, item] };
    });
  };

  const handleSkillCreated = (index: number, skill: Skill) => {
    setAvailableSkills((prev) =>
      prev.some((existing) => existing.id === skill.id) ? prev : [skill, ...prev]
    );
    updateHeroForm(index, (current) => {
      if (current.skills.some((existing) => existing.id === skill.id)) {
        return current;
      }
      return { ...current, skills: [...current.skills, skill] };
    });
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
    if (isHeroLimitReached) {
      setNewHeroError("Hero limit reached.");
      return;
    }

    const name = newHeroForm.name.trim();
    const unitType = newHeroForm.unit_type.trim();
    if (!name || !unitType || !newHeroForm.race_id) {
      setNewHeroError("Name, type, and race are required.");
      return;
    }

    setHeroForms((prev) => [
      ...prev,
      {
        name,
        unit_type: unitType,
        race_id: newHeroForm.race_id,
        race_name: newHeroForm.race_name,
        stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
        xp: newHeroForm.xp.trim() || "0",
        price: newHeroForm.price.trim() || "0",
        armour_save: "",
        available_skills: skillFields.reduce(
          (acc, field) => ({ ...acc, [field.key]: false }),
          {}
        ),
        items: [],
        skills: [],
      },
    ]);

    setNewHeroForm({
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      price: "0",
      xp: "0",
    });
    setRaceQuery("");
    setNewHeroError("");
    setIsAddingHeroForm(false);
  };

  const handleSaveChanges = async () => {
    if (!warband || !canEdit) {
      return;
    }

    const trimmedName = warbandForm.name.trim();
    const trimmedFaction = warbandForm.faction.trim();
    if (!trimmedName || !trimmedFaction) {
      setSaveError("Name and faction are required.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const updatedWarband = await updateWarband(warband.id, {
        name: trimmedName,
        faction: trimmedFaction,
      });
      setWarband(updatedWarband);

      const buildStatPayload = (hero: HeroFormEntry) =>
        statFields.reduce((acc, key) => {
          const value = hero.stats[key];
          if (String(value).trim()) {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
              return { ...acc, [statFieldMap[key]]: parsed };
            }
          }
          return acc;
        }, {} as Record<string, number>);

      const createPromises = heroForms
        .filter((hero) => !hero.id)
        .map((hero) =>
          createWarbandHero(warband.id, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race_id ?? null,
            price: toNullableNumber(hero.price) ?? 0,
            xp: toNullableNumber(hero.xp) ?? 0,
            armour_save: hero.armour_save.trim() || null,
            ...buildStatPayload(hero),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
          })
        );

      const updatePromises = heroForms
        .filter((hero) => hero.id)
        .map((hero) =>
          updateWarbandHero(warband.id, hero.id as number, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race_id ?? null,
            price: toNullableNumber(hero.price) ?? 0,
            xp: toNullableNumber(hero.xp) ?? 0,
            armour_save: hero.armour_save.trim() || null,
            ...buildStatPayload(hero),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
          })
        );

      const deletePromises = removedHeroIds.map((heroId) =>
        deleteWarbandHero(warband.id, heroId)
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

      const refreshed = await listWarbandHeroes(warband.id);
      setHeroes(refreshed);
      setHeroForms([]);
      setRemovedHeroIds([]);
      setIsEditing(false);
      setSaveMessage("Warband updated.");
      setExpandedHeroId(null);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to update warband");
      } else {
        setSaveError("Unable to update warband");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {warband ? (
        <header>
          <p className="text-xs font-semibold text-muted-foreground">warband</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            {warband.name}
            <span className="text-base text-muted-foreground"> - {warband.faction}</span>
          </h1>
        </header>
      ) : (
        <header>
          <p className="text-xs font-semibold text-muted-foreground">warband</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Raise your banner</h1>
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
              {isViewingOther ? "No warband found for this record." : "No warband logged for this campaign yet."}
            </p>
            {!isViewingOther ? <CreateWarbandDialog onCreate={handleCreate} /> : null}
          </div>
        </Card>
      ) : (
        <TabbedCard
          tabs={[
            { id: "warband" as WarbandTab, label: "Warband" },
            { id: "info" as WarbandTab, label: "Info" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {activeTab === "warband" ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-1">
                      Gold crowns{" "}
                      <span className="text-foreground">{goldCrowns}</span>
                    </span>
                    <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-1">
                      Rating <span className="text-foreground">{warbandRating}</span>
                    </span>
                    {otherResources.map((resource) => (
                      <span
                        key={resource.id}
                        className="rounded-md border border-border/70 bg-muted/30 px-2 py-1"
                      >
                        {resource.name}{" "}
                        <span className="text-foreground">{resource.amount}</span>
                      </span>
                    ))}
                  </div>
                  {saveMessage ? <p className="text-sm text-primary">{saveMessage}</p> : null}
                  {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  {canEdit && !isEditing ? (
                    <Button variant="outline" onClick={startEditing}>
                      Edit warband
                    </Button>
                  ) : null}
                  {canEdit && isEditing ? (
                    <>
                      <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save changes"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={cancelEditing}>
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Edit warband
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Warband name</Label>
                      <Input
                        value={warbandForm.name}
                        onChange={(event) =>
                          setWarbandForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Warband name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Faction</Label>
                      <Input
                        value={warbandForm.faction}
                        onChange={(event) =>
                          setWarbandForm((prev) => ({ ...prev, faction: event.target.value }))
                        }
                        placeholder="Faction"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">heroes</h2>
                  {isEditing ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsAddingHeroForm(true);
                        setNewHeroError("");
                      }}
                      disabled={isHeroLimitReached}
                    >
                      Add hero
                    </Button>
                  ) : null}
                </div>
                {isItemsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading items...</p>
                ) : null}
                {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
                {isSkillsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading skills...</p>
                ) : null}
                {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
                {isRacesLoading ? (
                  <p className="text-xs text-muted-foreground">Loading races...</p>
                ) : null}
                {racesError ? <p className="text-xs text-red-500">{racesError}</p> : null}
                {isEditing ? (
                  <div className="space-y-5">
                    {isAddingHeroForm ? (
                      <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-foreground shadow-[0_16px_32px_rgba(5,20,24,0.3)]">
                        <CreateRaceDialog
                          campaignId={campaignId}
                          onCreated={(race) => {
                            handleRaceCreated(race);
                            setNewHeroForm((prev) => ({
                              ...prev,
                              race_id: race.id,
                              race_name: race.name,
                            }));
                            setRaceQuery(race.name);
                            setNewHeroError("");
                          }}
                          open={isRaceDialogOpen}
                          onOpenChange={setIsRaceDialogOpen}
                          trigger={null}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-accent">new hero</p>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" onClick={handleAddHero}>
                              Create hero
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setIsAddingHeroForm(false);
                                setNewHeroError("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <div className="min-w-[180px] flex-1 space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Name</Label>
                            <Input
                              value={newHeroForm.name}
                              onChange={(event) => {
                                setNewHeroForm((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }));
                                setNewHeroError("");
                              }}
                              placeholder="Hero name"
                            />
                          </div>
                          <div className="min-w-[160px] flex-1 space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Type</Label>
                            <Input
                              value={newHeroForm.unit_type}
                              onChange={(event) => {
                                setNewHeroForm((prev) => ({
                                  ...prev,
                                  unit_type: event.target.value,
                                }));
                                setNewHeroError("");
                              }}
                              placeholder="Leader, Champion"
                            />
                          </div>
                          <div className="min-w-[200px] flex-[1.2] space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Race</Label>
                            <div className="relative">
                              <ActionSearchInput
                                value={raceQuery}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setRaceQuery(value);
                                  setNewHeroForm((prev) => ({
                                    ...prev,
                                    race_id: null,
                                    race_name: "",
                                  }));
                                  setNewHeroError("");
                                }}
                                placeholder="Search races..."
                                actionLabel="Create"
                                actionAriaLabel="Create race"
                                actionVariant="outline"
                                actionClassName="h-8 border-border/60 bg-background/70 text-foreground hover:border-primary/60"
                                onAction={() => setIsRaceDialogOpen(true)}
                              />
                              {matchingRaces.length > 0 ? (
                                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-1 shadow-[0_12px_30px_rgba(5,20,24,0.35)]">
                                  {matchingRaces.map((race) => (
                                    <button
                                      key={race.id}
                                      type="button"
                                      onClick={() => {
                                        setNewHeroForm((prev) => ({
                                          ...prev,
                                          race_id: race.id,
                                          race_name: race.name,
                                        }));
                                        setRaceQuery(race.name);
                                        setNewHeroError("");
                                      }}
                                      className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground hover:border-primary/60"
                                    >
                                      <span className="font-semibold">{race.name}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="min-w-[140px] flex-1 space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Hire cost</Label>
                            <Input
                              type="number"
                              min={0}
                              value={newHeroForm.price}
                              onChange={(event) =>
                                setNewHeroForm((prev) => ({
                                  ...prev,
                                  price: event.target.value,
                                }))
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="min-w-[140px] flex-1 space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Experience</Label>
                            <Input
                              type="number"
                              min={0}
                              value={newHeroForm.xp}
                              onChange={(event) =>
                                setNewHeroForm((prev) => ({
                                  ...prev,
                                  xp: event.target.value,
                                }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </div>
                        {newHeroError ? (
                          <p className="text-sm text-red-600">{newHeroError}</p>
                        ) : null}
                        {isHeroLimitReached ? (
                          <p className="text-xs text-muted-foreground">
                            Maximum of 6 heroes reached.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {heroForms.map((hero, index) => (
                      <HeroFormCard
                        key={hero.id ?? `new-${index}`}
                        hero={hero}
                        index={index}
                        campaignId={campaignId}
                        statFields={statFields}
                        skillFields={skillFields}
                        availableRaces={availableRaces}
                        availableItems={availableItems}
                        availableSkills={availableSkills}
                        onUpdate={updateHeroForm}
                        onRemove={handleRemoveHero}
                        onItemCreated={handleItemCreated}
                        onSkillCreated={handleSkillCreated}
                        onRaceCreated={handleRaceCreated}
                      />
                    ))}
                  </div>
                ) : heroes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No heroes logged yet. Start with your leader and key champions.
                  </p>
                ) : (
                  <div className="warband-hero-grid">
                    {heroes.map((hero, index) => {
                      const isExpanded = expandedHeroId === hero.id;
                      const columnIndexSm = index % 2;
                      const columnIndexXl = index % 3;
                      const overlayOffsetClass = [
                        columnIndexSm === 0
                          ? "sm:left-0"
                          : "sm:-left-[calc(100%+1rem)]",
                        columnIndexXl === 0
                          ? "xl:left-0"
                          : columnIndexXl === 1
                          ? "xl:-left-[calc(100%+1rem)]"
                          : "xl:-left-[calc(200%+2rem)]",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <div
                          key={hero.id}
                          className={[
                            "warband-hero-slot",
                            isExpanded ? "warband-hero-slot--expanded" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <HeroSummaryCard
                            hero={hero}
                            isExpanded={isExpanded}
                            overlayClassName={overlayOffsetClass}
                            onToggle={() =>
                              setExpandedHeroId((current) =>
                                current === hero.id ? null : hero.id
                              )
                            }
                            onCollapse={() => setExpandedHeroId(null)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-border/60 pt-4">
                <h2 className="text-sm font-semibold text-muted-foreground">henchmen</h2>
                <p className="text-sm text-muted-foreground">
                  This section is ready for future entries.
                </p>
              </div>

              <div className="space-y-3 border-t border-border/60 pt-4">
                <h2 className="text-sm font-semibold text-muted-foreground">hired swords</h2>
                <p className="text-sm text-muted-foreground">
                  This section is ready for future entries.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Warband notes, history, and extra info can live here.
            </p>
          )}
        </TabbedCard>
      )}
    </div>
  );
}
