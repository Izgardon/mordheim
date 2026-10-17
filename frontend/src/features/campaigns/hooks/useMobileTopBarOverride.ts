import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import type { MobileTopBarConfig } from "../routes/CampaignLayout";

/**
 * The mobile top bar: the layout's default, with whatever the current page overrides on top.
 * Only the override is stored and the two are combined at render time, so the default changing
 * (a notification arriving, the Rejoin button appearing) can't wipe a page's override, such as
 * Warband edit mode's Save/Cancel (BUG-24). An override belongs to the path that set it and is
 * dropped on navigation; the setter is stable for as long as the path is.
 */
export function useMobileTopBarOverride(defaultTopBar: MobileTopBarConfig) {
  const { pathname } = useLocation();
  const [override, setOverride] = useState<{
    pathname: string;
    config: Partial<MobileTopBarConfig>;
  } | null>(null);

  const setMobileTopBar = useCallback(
    (config: Partial<MobileTopBarConfig>) => setOverride({ pathname, config }),
    [pathname]
  );

  const topBar = useMemo(
    () =>
      override && override.pathname === pathname
        ? { ...defaultTopBar, ...override.config }
        : defaultTopBar,
    [defaultTopBar, override, pathname]
  );

  return { topBar, setMobileTopBar };
}
