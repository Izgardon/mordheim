import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { GameIcon, type GameIconName } from "@/components/ui/game-icons";
import { MoreMenu, type MoreMenuEntry } from "@/components/ui/more-menu";
import { useMediaQuery } from "@/lib/use-media-query";

export type WarbandPanel = "store" | "stash" | "locations" | "loadout" | "hire";

type WarbandHeaderProps = {
  kicker: string;
  name: string;
  stashCount: number;
  showLocations: boolean;
  /** The ⋯ menu's Encampments: the phone's way to that page (the rail has it on the web). */
  showEncampment: boolean;
  onOpen: (panel: WarbandPanel) => void;
  menu: MoreMenuEntry[];
  /** Before the buttons: a workshop's share code with Copy. */
  code?: ReactNode;
};

const PANEL_BUTTONS: { panel: WarbandPanel; label: string; icon: GameIconName }[] = [
  { panel: "store", label: "Store", icon: "store" },
  { panel: "stash", label: "Stash", icon: "stash" },
  { panel: "locations", label: "Trade locations", icon: "locations" },
];

/** The warband's name and kicker, the Store, Stash and Trade locations buttons, and the ⋯ menu. */
export default function WarbandHeader(props: WarbandHeaderProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const menu = props.showEncampment
    ? [
        ...props.menu,
        { label: "Encampments", onSelect: () => navigate(`/campaigns/${id}/encampments`) },
      ]
    : props.menu;
  const isMobile = useMediaQuery("(max-width: 960px)");
  const buttons = PANEL_BUTTONS.filter(
    (button) => button.panel !== "locations" || props.showLocations
  );
  const panelButton = (button: (typeof PANEL_BUTTONS)[number]) => (
    <Button
      key={button.panel}
      variant="secondary"
      size="lg"
      className={isMobile ? "w-full min-w-0 px-3" : "min-w-[140px]"}
      onClick={() => props.onOpen(button.panel)}
    >
      <GameIcon name={button.icon} className="h-5 w-5 text-accent-text" />
      {button.label}
      {button.panel === "stash" && props.stashCount ? (
        <span className="font-mono text-xs text-accent-text">{props.stashCount}</span>
      ) : null}
    </Button>
  );
  const more = <MoreMenu label="More warband actions" entries={menu} />;

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
      <div className="flex flex-wrap items-center gap-2 max-[960px]:w-full">
        {/* on a phone, a line of its own above the buttons */}
        {props.code ? <div className="flex max-[960px]:basis-full">{props.code}</div> : null}
        {isMobile ? (
          <>
            {/* Store, Stash and ⋯ share a row, as the page's skeleton draws it */}
            <div className="grid w-full grid-cols-[1fr_1fr_auto] gap-2">
              {buttons.filter((button) => button.panel !== "locations").map(panelButton)}
              {more}
            </div>
            {buttons.filter((button) => button.panel === "locations").map(panelButton)}
          </>
        ) : (
          <>
            {buttons.map(panelButton)}
            {more}
          </>
        )}
      </div>
    </header>
  );
}
