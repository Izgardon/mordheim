import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

// routing
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

// components
import CampaignSidebar from "../components/layout/CampaignSidebar";
import { DesktopLayout } from "@/layouts/desktop";
import { MobileLayout, MobileTopBar } from "@/layouts/mobile";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import WarbandMobileNav from "@/features/warbands/components/warband/WarbandMobileNav";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  Book,
  Castle,
  ChevronLeft,
  House,
  PawPrint,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import CampaignDiceRollerMenu from "@/features/realtime/components/CampaignDiceRollerMenu";
import CampaignChatMenu from "@/features/realtime/components/CampaignChatMenu";
import NotificationsMenu from "@/features/realtime/components/NotificationsMenu";
import { useNotifications } from "@/features/realtime/hooks/useNotifications";

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
  { label: "Campaign", path: "", icon: Castle },
  { label: "Warband", path: "warband", icon: Swords },
  { label: "Skills", path: "skills", icon: Book },
  { label: "Spells", path: "spells", icon: Sparkles },
  { label: "Wargear", path: "items", icon: Shield },
  { label: "Bestiary", path: "bestiary", icon: PawPrint },
  { label: "Hired Swords", path: "hired-swords", icon: PawPrint },
  { label: "Rules", path: "rules", icon: ScrollText },
  { label: "House Rules", path: "house-rules", icon: House },
];

export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
  lookups: CampaignLookups;
  setMobileTopBar?: (config: Partial<MobileTopBarConfig>) => void;
  setCampaign?: Dispatch<SetStateAction<CampaignSummary | null>>;
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
  const {
    tradeRequestNotifications,
    battleInviteNotifications,
    battleResultRequestNotifications,
    acceptTradeNotification,
    declineTradeNotification,
    acceptBattleInviteNotification,
    dismissBattleInviteNotification,
    acceptBattleResultRequestNotification,
    declineBattleResultRequestNotification,
    clearNotifications,
  } = useNotifications(false);
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
      case "bestiary":
        return "Bestiary";
      case "hired-swords":
        return "Hired Swords";
      case "rules":
        return "Rules";
      case "house-rules":
        return "House Rules";
      case "settings":
        return "Settings";
      case "battles":
        return "Battle";
      default:
        return "Overview";
    }
  }, [pathSegments]);
  const settingsButton = useMemo(
    () => (
      <Button
        type="button"
        onClick={() => navigate(`/campaigns/${id}/settings`)}
        variant="icon"
        size="icon"
        className="h-9 w-9"
        aria-label="Settings"
      >
        <Settings className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
      </Button>
    ),
    [id, navigate]
  );
  const backButton = useMemo(
    () => (
      <Button
        type="button"
        onClick={() => navigate(-1)}
        variant="icon"
        size="icon"
        className="h-9 w-9"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
      </Button>
    ),
    [navigate]
  );
  const notificationsButton = useMemo(
    () => (
      <NotificationsMenu
        tradeRequestNotifications={tradeRequestNotifications}
        battleInviteNotifications={battleInviteNotifications}
        battleResultRequestNotifications={battleResultRequestNotifications}
        onAcceptTrade={acceptTradeNotification}
        onDeclineTrade={declineTradeNotification}
        onAcceptBattleInvite={acceptBattleInviteNotification}
        onDismissBattleInvite={dismissBattleInviteNotification}
        onAcceptBattleResultRequest={acceptBattleResultRequestNotification}
        onDeclineBattleResultRequest={declineBattleResultRequestNotification}
        onClear={clearNotifications}
      />
    ),
    [
      acceptBattleInviteNotification,
      acceptBattleResultRequestNotification,
      acceptTradeNotification,
      battleInviteNotifications,
      battleResultRequestNotifications,
      clearNotifications,
      declineTradeNotification,
      declineBattleResultRequestNotification,
      dismissBattleInviteNotification,
      tradeRequestNotifications,
    ]
  );
  const diceRollerButton = useMemo(() => <CampaignDiceRollerMenu />, []);
  const chatButton = useMemo(() => <CampaignChatMenu campaignId={campaignId} />, [campaignId]);
  const defaultTopBar = useMemo<MobileTopBarConfig>(
    () => ({
      title: defaultMobileTitle,
      leftSlot: backButton,
      rightSlot: (
        <div className="flex items-center gap-2">
          {diceRollerButton}
          {chatButton}
          {notificationsButton}
        </div>
      ),
    }),
    [backButton, chatButton, defaultMobileTitle, diceRollerButton, notificationsButton]
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

  const campaignId2 = campaign?.id ?? null;
  const loadWarband = useCallback(async () => {
    if (!campaignId2) {
      setWarband(null);
      setWarbandError("");
      setWarbandLoading(false);
      return;
    }

    setWarbandLoading(true);
    setWarbandError("");

    try {
      const warband = await getWarband(campaignId2);
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
  }, [campaignId2, setWarband, setWarbandError, setWarbandLoading]);

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
      <Outlet
        context={{
          campaign,
          lookups,
          setMobileTopBar: applyMobileTopBar,
          setCampaign,
        }}
      />
    </section>
  );

  if (isMobile) {
    const path = location.pathname;
    const isBattleRoute = path.includes("/battles/");
    const mobileNavActiveId = (() => {
      if (path.includes("/battles/")) return "overview" as const;
      if (path.includes("/settings")) return "settings" as const;
      if (path.includes("/rules") || path.includes("/house-rules")) return "rules" as const;
      if (path.includes("/warband")) return "warband" as const;
      if (path.includes("/items") || path.includes("/skills") || path.includes("/spells")) return "loadout" as const;
      return "overview" as const;
    })();

    if (isBattleRoute) {
      return (
        <MobileLayout topBarOffset="0px" contentClassName="pt-0 pb-0">
          {content}
        </MobileLayout>
      );
    }

    return (
      <MobileLayout
        topBar={<MobileTopBar {...mobileTopBar} position="sticky" />}
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
      topBar={
        <div className="flex h-full items-center justify-end gap-2 border-b border-border/70 bg-[#100d09] px-6">
          <div className="flex items-center gap-2">
            <CampaignDiceRollerMenu />
            <CampaignChatMenu campaignId={campaignId} />
            <NotificationsMenu
              tradeRequestNotifications={tradeRequestNotifications}
              battleInviteNotifications={battleInviteNotifications}
              battleResultRequestNotifications={battleResultRequestNotifications}
              onAcceptTrade={acceptTradeNotification}
              onDeclineTrade={declineTradeNotification}
              onAcceptBattleInvite={acceptBattleInviteNotification}
              onDismissBattleInvite={dismissBattleInviteNotification}
              onAcceptBattleResultRequest={acceptBattleResultRequestNotification}
              onDeclineBattleResultRequest={declineBattleResultRequestNotification}
              onClear={clearNotifications}
            />
          </div>
        </div>
      }
    >
      {content}
    </DesktopLayout>
  );
}
