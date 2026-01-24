import { useCallback, useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

import "../styles/warband.css";

// components
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import TabSwitcher from "../../../components/ui/tab-switcher";
import CreateWarbandDialog from "../components/CreateWarbandDialog";
import HeroFormCard from "../components/HeroFormCard";
import HeroSummaryCard from "../components/HeroSummaryCard";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";

// api
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";
import { listItems } from "../../items/api/items-api";
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
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<WarbandTab>("warband");
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({
    name: "",
    faction: "",
  });
  const [expandedHeroId, setExpandedHeroId] = useState<number | null>(null);

  const campaignId = useMemo(() => Number(id), [id]);
  const resolvedWarbandId = useMemo(() => (warbandId ? Number(warbandId) : null), [warbandId]);
  const isViewingOther = resolvedWarbandId !== null;

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
      const data = await listItems();
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
  }, []);

  const loadSkills = useCallback(async () => {
    setIsSkillsLoading(true);
    setSkillsError("");

    try {
      const data = await listSkills();
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
  }, []);

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

  useEffect(() => {
    loadWarband();
    loadItems();
    loadSkills();
    loadMemberPermissions();
  }, [loadWarband, loadItems, loadSkills, loadMemberPermissions]);

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
    setHeroForms(forms.length ? forms : [emptyHeroForm()]);
    setRemovedHeroIds([]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setHeroForms([]);
    setRemovedHeroIds([]);
    setSaveMessage("");
    setSaveError("");
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
    setHeroForms((prev) => (prev.length >= 6 ? prev : [...prev, emptyHeroForm()]));
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

      const createPromises = heroForms
        .filter((hero) => !hero.id && hasHeroContent(hero))
        .map((hero) =>
          createWarbandHero(warband.id, {
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
          updateWarbandHero(warband.id, hero.id as number, {
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
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            {isEditing ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
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
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                  {warband.faction}
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-foreground">{warband.name}</h1>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
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
            {saveMessage ? <span className="text-sm text-emerald-700">{saveMessage}</span> : null}
            {saveError ? <span className="text-sm text-red-600">{saveError}</span> : null}
          </div>
        </header>
      ) : (
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Warband
          </p>
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
        <div className="space-y-6">
          <TabSwitcher
            tabs={[
              { id: "warband" as WarbandTab, label: "Warband" },
              { id: "info" as WarbandTab, label: "Info" },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <Card>
            <CardHeader>
              <CardTitle>Warband</CardTitle>
              <CardDescription>Roster sections for your warband.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {activeTab === "warband" ? (
                <>
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Heroes
                    </h2>
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
                            campaignId={campaignId}
                            statFields={statFields}
                            skillFields={skillFields}
                            availableItems={availableItems}
                            availableSkills={availableSkills}
                            onUpdate={updateHeroForm}
                            onRemove={handleRemoveHero}
                            onItemCreated={handleItemCreated}
                            onSkillCreated={handleSkillCreated}
                          />
                        ))}

                        {heroForms.length < 6 ? (
                          <Button type="button" variant="secondary" onClick={handleAddHero}>
                            + Add hero
                          </Button>
                        ) : null}
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
                    <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Henchmen
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      This section is ready for future entries.
                    </p>
                  </div>

                  <div className="space-y-3 border-t border-border/60 pt-4">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Hired swords
                    </h2>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
