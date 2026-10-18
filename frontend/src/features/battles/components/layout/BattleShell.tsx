import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useOutletContext } from "react-router-dom";

import "../../styles/battle.css";

import { LoadingScreen } from "@/components/ui/loading-screen";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useMediaQuery } from "@/lib/use-media-query";

import { BattleMobileBottomBar, BattleMobileTopBar } from "./BattleMobileBars";
import type {
  BattleLayoutContext,
  BattleMobileBottomBarConfig,
  BattleMobileTopBarConfig,
} from "./battle-shell-types";

/**
 * The battle pages' chrome: the phone's top and bottom bars, which the page fills through the
 * outlet context's setters. `children` renders the page with that context (the outlet by default).
 */
export default function BattleShell({
  children,
}: {
  children?: (outletContext: BattleLayoutContext) => ReactNode;
}) {
  const parentContext = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [topBarConfig, setTopBarConfig] = useState<BattleMobileTopBarConfig | null>(null);
  const [bottomBarConfig, setBottomBarConfig] = useState<BattleMobileBottomBarConfig | null>(null);

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

  const page = (
    <Suspense fallback={<LoadingScreen message="Loading battle..." />}>
      {children ? children(outletContext) : <Outlet context={outletContext} />}
    </Suspense>
  );

  // The page keeps its position whichever chrome is shown, so crossing 960 px doesn't remount
  // it mid-battle (BUG-23).
  return (
    <div className={isMobile ? "relative min-h-full" : undefined}>
      {isMobile ? <BattleMobileTopBar config={topBarConfig} /> : null}
      <div
        className={
          isMobile
            ? "px-2 pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] pt-[calc(env(safe-area-inset-top,0px)+6.6rem)]"
            : undefined
        }
      >
        {page}
      </div>
      {isMobile ? <BattleMobileBottomBar config={bottomBarConfig} /> : null}
    </div>
  );
}
