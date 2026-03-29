import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import CampaignDiceRollerMenu from "@/features/realtime/components/CampaignDiceRollerMenu";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ButtonProps } from "@/components/ui/button";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

type BattleMobileOption = {
  value: string;
  label: string;
};

type BattleMobileTopBarConfig = {
  title: string;
  onBack: () => void;
  extraActions?: ReactNode;
  warbandOptions?: BattleMobileOption[];
  readyWarbandValues?: string[];
  selectedWarbandValue?: string;
  onWarbandChange?: (value: string) => void;
  unitTypeOptions?: BattleMobileOption[];
  selectedUnitTypeValue?: string;
  onUnitTypeChange?: (value: string) => void;
};

type BattleMobileAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
};

type BattleMobileBottomBarConfig = {
  primaryAction?: BattleMobileAction;
  secondaryAction?: BattleMobileAction;
};

export type BattleLayoutContext = CampaignLayoutContext & {
  setBattleMobileTopBar?: (config: BattleMobileTopBarConfig | null) => void;
  setBattleMobileBottomBar?: (config: BattleMobileBottomBarConfig | null) => void;
};

function BattleMobileTopBar({
  config,
}: {
  config: BattleMobileTopBarConfig | null;
}) {
  const hasDropdowns = Boolean(
    config?.warbandOptions?.length &&
      config?.unitTypeOptions?.length &&
      config.selectedWarbandValue &&
      config.selectedUnitTypeValue &&
      config.onWarbandChange &&
      config.onUnitTypeChange
  );
  const selectedWarbandReady = Boolean(
    config?.readyWarbandValues?.includes(config.selectedWarbandValue)
  );

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="border-b border-[#2b2117]/80 bg-[#0b0a08]/85 backdrop-blur-md">
        <div className="flex min-h-[3rem] items-center justify-between gap-2 px-3 pb-1 pt-[calc(env(safe-area-inset-top,0px)+0.55rem)]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
              onClick={() => config?.onBack()}
              disabled={!config}
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
            </button>
            <p className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-[#e9dcc2]">
              {config?.title ?? "Battle"}
            </p>
          </div>
          <div className="flex items-center">
            {config?.extraActions ?? null}
            <CampaignDiceRollerMenu />
          </div>
        </div>
        {config && hasDropdowns ? (
          <div className="flex items-center gap-2 px-3 pb-2">
            <div className="relative min-w-0 flex-1">
              <select
                value={config.selectedWarbandValue}
                onChange={(event) => config.onWarbandChange?.(event.target.value)}
                className="h-8 min-w-0 w-full appearance-none border border-[#3b2f25] bg-[#16120f] pl-2 pr-10 text-xs font-semibold text-[#e9dcc2] outline-none focus:border-[#6f5a43]"
                style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none" }}
              >
                {config.warbandOptions?.map((option) => (
                  <option key={`warband-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1.5 text-[#e9dcc2]">
                {selectedWarbandReady ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="relative flex-1">
              <select
                value={config.selectedUnitTypeValue}
                onChange={(event) => config.onUnitTypeChange?.(event.target.value)}
                className="h-8 w-full appearance-none border border-[#3b2f25] bg-[#16120f] pl-2 pr-8 text-xs font-semibold text-[#e9dcc2] outline-none focus:border-[#6f5a43]"
                style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none" }}
              >
                {config.unitTypeOptions?.map((option) => (
                  <option key={`unit-type-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-2 my-auto h-3.5 w-3.5 text-[#e9dcc2]" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BattleMobileBottomBar({
  config,
}: {
  config: BattleMobileBottomBarConfig | null;
}) {
  if (!config) {
    return null;
  }

  return (
    <nav className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 w-full">
      <div
        className="w-full border-t border-[#3b2f25] bg-[#1f1813]/95 px-3 pt-2 shadow-[0_18px_40px_rgba(12,10,9,0.55)] backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.7rem)" }}
      >
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {config.primaryAction ? (
            <Button
              size="sm"
              variant={config.primaryAction.variant ?? "secondary"}
              onClick={config.primaryAction.onClick}
              disabled={config.primaryAction.disabled}
              className="w-36 shrink-0"
            >
              {config.primaryAction.label}
            </Button>
          ) : null}
          {config.secondaryAction ? (
            <Button
              size="sm"
              variant={config.secondaryAction.variant ?? "default"}
              onClick={config.secondaryAction.onClick}
              disabled={config.secondaryAction.disabled}
              className="w-36 shrink-0"
            >
              {config.secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

export default function BattleLayout() {
  const parentContext = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [topBarConfig, setTopBarConfig] = useState<BattleMobileTopBarConfig | null>(null);
  const [bottomBarConfig, setBottomBarConfig] = useState<BattleMobileBottomBarConfig | null>(
    null
  );

  useEffect(() => {
    return () => {
      setTopBarConfig(null);
      setBottomBarConfig(null);
    };
  }, []);

  const outletContext = useMemo<BattleLayoutContext>(
    () => ({
      ...parentContext,
      setBattleMobileTopBar: setTopBarConfig,
      setBattleMobileBottomBar: setBottomBarConfig,
    }),
    [parentContext]
  );

  if (!isMobile) {
    return <Outlet context={outletContext} />;
  }

  return (
    <div className="relative min-h-full">
      <BattleMobileTopBar config={topBarConfig} />
      <div className="px-2 pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] pt-[calc(env(safe-area-inset-top,0px)+6.6rem)]">
        <Outlet context={outletContext} />
      </div>
      <BattleMobileBottomBar config={bottomBarConfig} />
    </div>
  );
}
