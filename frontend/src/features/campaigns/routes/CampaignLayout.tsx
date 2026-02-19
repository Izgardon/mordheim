import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// routing
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

// components
import CampaignSidebar from "../components/layout/CampaignSidebar";
import { DesktopLayout } from "@/layouts/desktop";
import { MobileLayout, MobileTopBar } from "@/layouts/mobile";
import { LoadingScreen } from "@/components/ui/loading-screen";
import WarbandMobileNav from "@/features/warbands/components/warband/WarbandMobileNav";
import { useMediaQuery } from "@/lib/use-media-query";
import { ChevronLeft, Settings } from "lucide-react";

// api
import { getCampaign } from "../api/campaigns-api";
import { getWarband, getWarbandSummary } from "@/features/warbands/api/warbands-api";
import { useCampaignItems } from "@/features/warbands/hooks/campaign/useCampaignItems";
import { useCampaignRaces } from "@/features/warbands/hooks/campaign/useCampaignRaces";
import { useCampaignSkills } from "@/features/warbands/hooks/campaign/useCampaignSkills";
import { useCampaignSpells } from "@/features/warbands/hooks/campaign/useCampaignSpells";
import { useCampaignSpecial } from "@/features/warbands/hooks/campaign/useCampaignSpecial";
import { useAppStore } from "@/stores/app-store";

// utils

// types
import type { CampaignSummary } from "../types/campaign-types";
import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { Special } from "@/features/special/types/special-types";
import type { Race } from "@/features/races/types/race-types";

const navItems = [
  { label: "Campaign", path: "" },
  { label: "Warband", path: "warband" },
  { label: "Skills", path: "skills" },
  { label: "Spells", path: "spells" },
  { label: "Wargear", path: "items" },
  { label: "Rules", path: "rules" },
  { label: "House Rules", path: "house-rules" },
];

export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
  lookups: CampaignLookups;
  setMobileTopBar?: (config: Partial<MobileTopBarConfig>) => void;
};

export type MobileTopBarConfig = {
  title: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export type CampaignLookups = {
  availableItems: Item[];
  itemsError: string;
  isItemsLoading: boolean;
  loadItems: () => Promise<void>;
  availableSkills: Skill[];
  skillsError: string;
  isSkillsLoading: boolean;
  loadSkills: () => Promise<void>;
  availableSpells: Spell[];
  spellsError: string;
  isSpellsLoading: boolean;
  loadSpells: () => Promise<void>;
  availableSpecials: Special[];
  specialsError: string;
  isSpecialsLoading: boolean;
  loadSpecials: () => Promise<void>;
  availableRaces: Race[];
  racesError: string;
  isRacesLoading: boolean;
  loadRaces: () => Promise<void>;
  handleRaceCreated: (race: Race) => void;
};

export default function CampaignLayout() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lookupsReady, setLookupsReady] = useState(false);
  const { setWarband, setWarbandLoading, setWarbandError, setCampaignStarted } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const navigate = useNavigate();
  const location = useLocation();
  const campaignId = Number(id);
  const hasCampaignId = Boolean(id);
  const pathSegments = useMemo(
    () => location.pathname.split("/").filter(Boolean),
    [location.pathname]
  );
  const defaultMobileTitle = useMemo(() => {
    const section = pathSegments[2] ?? "overview";
    switch (section) {
      case "warband":
        return "Warband";
      case "items":
        return "Wargear";
      case "skills":
        return "Skills";
      case "spells":
        return "Spells";
      case "rules":
        return "Rules";
      case "house-rules":
        return "House Rules";
      case "settings":
        return "Settings";
      default:
        return "Overview";
    }
  }, [pathSegments]);
  const settingsButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => navigate(`/campaigns/${id}/settings`)}
        className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
        aria-label="Settings"
      >
        <Settings className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
      </button>
    ),
    [id, navigate]
  );
  const backButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
      </button>
    ),
    [navigate]
  );
  const defaultTopBar = useMemo<MobileTopBarConfig>(
    () => ({
      title: defaultMobileTitle,
      leftSlot: backButton,
      rightSlot: settingsButton,
    }),
    [backButton, defaultMobileTitle, settingsButton]
  );
  const [mobileTopBar, setMobileTopBar] = useState<MobileTopBarConfig>(defaultTopBar);
  const applyMobileTopBar = useCallback(
    (config: Partial<MobileTopBarConfig>) => {
      setMobileTopBar({ ...defaultTopBar, ...config });
    },
    [defaultTopBar]
  );

  useEffect(() => {
    setMobileTopBar(defaultTopBar);
  }, [defaultTopBar]);

  const shouldPrefetchLookups = Boolean(campaign) && hasCampaignId && !Number.isNaN(campaignId);

  useEffect(() => {
    if (!id) {
      return;
    }

    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    getCampaign(campaignId)
      .then((data) => {
        setCampaign(data);
        setCampaignStarted(data?.in_progress ?? false);
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load campaign");
        } else {
          setError("Unable to load campaign");
        }
      })
      .finally(() => setIsLoading(false));
  }, [campaignId, id]);

  const {
    availableItems,
    itemsError,
    isItemsLoading,
    loadItems,
  } = useCampaignItems({ campaignId, hasCampaignId, enabled: shouldPrefetchLookups, auto: false });

  const {
    availableSkills,
    skillsError,
    isSkillsLoading,
    loadSkills,
  } = useCampaignSkills({ campaignId, hasCampaignId, enabled: shouldPrefetchLookups, auto: false });

  const {
    availableSpells,
    spellsError,
    isSpellsLoading,
    loadSpells,
  } = useCampaignSpells({ campaignId, hasCampaignId, enabled: shouldPrefetchLookups, auto: false });

  const {
    availableSpecials,
    specialsError,
    isSpecialsLoading,
    loadSpecials,
  } = useCampaignSpecial({ campaignId, hasCampaignId, enabled: shouldPrefetchLookups, auto: false });

  const {
    availableRaces,
    racesError,
    isRacesLoading,
    loadRaces,
    handleRaceCreated,
  } = useCampaignRaces({ campaignId, hasCampaignId, enabled: shouldPrefetchLookups, auto: false });

  useEffect(() => {
    if (!shouldPrefetchLookups) {
      setLookupsReady(false);
      return;
    }

    let active = true;
    setLookupsReady(false);

    Promise.allSettled([
      loadItems(),
      loadSkills(),
      loadSpells(),
      loadSpecials(),
      loadRaces(),
    ]).finally(() => {
      if (active) {
        setLookupsReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [loadItems, loadRaces, loadSkills, loadSpecials, loadSpells, shouldPrefetchLookups]);

  const lookups = useMemo<CampaignLookups>(
    () => ({
      availableItems,
      itemsError,
      isItemsLoading,
      loadItems,
      availableSkills,
      skillsError,
      isSkillsLoading,
      loadSkills,
      availableSpells,
      spellsError,
      isSpellsLoading,
      loadSpells,
      availableSpecials,
      specialsError,
      isSpecialsLoading,
      loadSpecials,
      availableRaces,
      racesError,
      isRacesLoading,
      loadRaces,
      handleRaceCreated,
    }),
    [
      availableItems,
      itemsError,
      isItemsLoading,
      loadItems,
      availableSkills,
      skillsError,
      isSkillsLoading,
      loadSkills,
      availableSpells,
      spellsError,
      isSpellsLoading,
      loadSpells,
      availableSpecials,
      specialsError,
      isSpecialsLoading,
      loadSpecials,
      availableRaces,
      racesError,
      isRacesLoading,
      loadRaces,
      handleRaceCreated,
    ]
  );

  const loadWarband = useCallback(async () => {
    if (!campaign) {
      setWarband(null);
      setWarbandError("");
      setWarbandLoading(false);
      return;
    }

    setWarbandLoading(true);
    setWarbandError("");

    try {
      const warband = await getWarband(campaign.id);
      if (warband) {
        const summary = await getWarbandSummary(warband.id);
        setWarband({ ...warband, ...summary });
      } else {
        setWarband(null);
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setWarbandError(errorResponse.message || "Unable to load warband");
      } else {
        setWarbandError("Unable to load warband");
      }
    } finally {
      setWarbandLoading(false);
    }
  }, [campaign, setWarband, setWarbandError, setWarbandLoading]);

  useEffect(() => {
    loadWarband();
  }, [loadWarband]);

  useEffect(() => {
    const handleWarbandUpdate = () => {
      loadWarband();
    };
    window.addEventListener("warband:updated", handleWarbandUpdate);
    return () => {
      window.removeEventListener("warband:updated", handleWarbandUpdate);
    };
  }, [loadWarband]);

  if (isLoading || (shouldPrefetchLookups && !lookupsReady)) {
    return <LoadingScreen message="Preparing the campaign..." />;
  }

  if (error || !campaign) {
    return (
      <main className="campaigns max-h-full bg-transparent">
        <div className="mx-auto flex max-h-full max-w-6xl items-center justify-center px-6 py-10">
          <p className="text-sm text-red-600">{error || "No record of that campaign."}</p>
        </div>
      </main>
    );
  }

  const content = (
    <section className="min-h-0 flex-1">
      <Outlet context={{ campaign, lookups, setMobileTopBar: applyMobileTopBar }} />
    </section>
  );

  if (isMobile) {
    const path = location.pathname;
    const mobileNavActiveId = (() => {
      if (path.includes("/settings")) return "settings" as const;
      if (path.includes("/rules") || path.includes("/house-rules")) return "rules" as const;
      if (path.includes("/warband")) return "warband" as const;
      if (path.includes("/items") || path.includes("/skills") || path.includes("/spells")) return "loadout" as const;
      return "overview" as const;
    })();

    return (
      <MobileLayout
        topBar={<MobileTopBar {...mobileTopBar} />}
        topBarOffset={
          mobileTopBar.meta
            ? "calc(env(safe-area-inset-top, 0px) + 7rem)"
            : "calc(env(safe-area-inset-top, 0px) + 4.25rem)"
        }
        bottomNav={
          <WarbandMobileNav
            activeId={mobileNavActiveId}
            onSelect={(navId) => {
              if (navId === "overview") navigate(`/campaigns/${id}`);
              else if (navId === "loadout") navigate(`/campaigns/${id}/items`);
              else if (navId === "warband") navigate(`/campaigns/${id}/warband`);
              else if (navId === "rules") navigate(`/campaigns/${id}/rules`);
              else if (navId === "settings") navigate(`/campaigns/${id}/settings`);
            }}
          />
        }
      >
        {content}
      </MobileLayout>
    );
  }

  return (
    <DesktopLayout
      navbar={
        <CampaignSidebar
          campaign={campaign}
          campaignId={id ?? ""}
          navItems={navItems}
          className="h-full w-full"
        />
      }
    >
      {content}
    </DesktopLayout>
  );
}
