import type { ReactNode } from "react";
import { Archive, Map, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MoreMenu, type MoreMenuEntry } from "@/components/ui/more-menu";

export type WarbandPanel = "store" | "stash" | "locations" | "loadout";

type WarbandHeaderProps = {
  kicker: string;
  name: string;
  stashCount: number;
  showLocations: boolean;
  onOpen: (panel: WarbandPanel) => void;
  menu: MoreMenuEntry[];
};

const PANEL_BUTTONS: { panel: WarbandPanel; label: string; icon: ReactNode }[] = [
  { panel: "store", label: "Store", icon: <ShoppingBag aria-hidden="true" /> },
  { panel: "stash", label: "Stash", icon: <Archive aria-hidden="true" /> },
  { panel: "locations", label: "Locations", icon: <Map aria-hidden="true" /> },
];

/** The warband's name and kicker, the Store, Stash and Locations buttons, and the ⋯ menu. */
export default function WarbandHeader(props: WarbandHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {props.kicker}
        </span>
        <h1 className="font-display text-[32px] font-semibold leading-tight text-head min-[960px]:text-[40px]">
          {props.name}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {PANEL_BUTTONS.filter((button) => button.panel !== "locations" || props.showLocations).map(
          (button) => (
            <Button
              key={button.panel}
              variant="secondary"
              size="lg"
              className="w-[140px] max-[960px]:w-auto max-[960px]:flex-1"
              onClick={() => props.onOpen(button.panel)}
            >
              {button.icon}
              {button.label}
              {button.panel === "stash" && props.stashCount ? (
                <span className="font-mono text-xs text-accent-text">{props.stashCount}</span>
              ) : null}
            </Button>
          )
        )}
        <MoreMenu label="More warband actions" entries={props.menu} />
      </div>
    </header>
  );
}
