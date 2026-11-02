import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { GameIcon, type GameIconName } from "@/components/ui/game-icons";
import { MoreMenu, type MoreMenuEntry } from "@/components/ui/more-menu";

export type WarbandPanel = "store" | "stash" | "locations" | "loadout";

type WarbandHeaderProps = {
  kicker: string;
  name: string;
  stashCount: number;
  showLocations: boolean;
  /** The ⋯ menu's Encampment: the phone's way to that page (the rail has it on the web). */
  showEncampment: boolean;
  onOpen: (panel: WarbandPanel) => void;
  menu: MoreMenuEntry[];
};

const PANEL_BUTTONS: { panel: WarbandPanel; label: string; icon: GameIconName }[] = [
  { panel: "store", label: "Store", icon: "store" },
  { panel: "stash", label: "Stash", icon: "stash" },
  { panel: "locations", label: "Locations", icon: "locations" },
];

/** The warband's name and kicker, the Store, Stash and Locations buttons, and the ⋯ menu. */
export default function WarbandHeader(props: WarbandHeaderProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const menu = props.showEncampment
    ? [
        ...props.menu,
        { label: "Encampment", onSelect: () => navigate(`/campaigns/${id}/encampments`) },
      ]
    : props.menu;

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
              <GameIcon name={button.icon} className="h-5 w-5 text-accent-text" />
              {button.label}
              {button.panel === "stash" && props.stashCount ? (
                <span className="font-mono text-xs text-accent-text">{props.stashCount}</span>
              ) : null}
            </Button>
          )
        )}
        <MoreMenu label="More warband actions" entries={menu} />
      </div>
    </header>
  );
}
