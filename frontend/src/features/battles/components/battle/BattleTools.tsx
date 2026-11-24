import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import { BookOpen, Crosshair, Dices, Ellipsis, Swords, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { BottomBar, BottomBarButton } from "@/layouts/mobile/BottomBar";

/** A tool the battle screen opens itself; Dice is the campaign's own roller (`openTool`). */
export type BattleTool = "rules" | "melee" | "ranged" | "menu";

type Entry = { tool: BattleTool | "dice"; label: string; icon: LucideIcon };

const RULES: Entry = { tool: "rules", label: "Rules", icon: BookOpen };
const MELEE: Entry = { tool: "melee", label: "Melee", icon: Swords };
const RANGED: Entry = { tool: "ranged", label: "Ranged", icon: Crosshair };
const DICE: Entry = { tool: "dice", label: "Dice", icon: Dices };
const MENU: Entry = { tool: "menu", label: "Menu", icon: Ellipsis };

/** The phone's bar: Dice in the middle, where the thumb rests (William, 24 Nov 2026). */
const PHONE = [RULES, MELEE, DICE, RANGED, MENU];
const WEB = [RULES, MELEE, RANGED, DICE, MENU];

/**
 * The battle's tools: the phone's bottom bar, or the buttons in the web header (`children` after
 * them: Next round). Dice opens the dice roller the campaign's header opens on every page
 * (William, 24 Nov 2026: "just copy the main dice roller as the battle dice roller").
 */
export default function BattleTools({
  isMobile,
  onOpen,
  children,
}: {
  isMobile: boolean;
  onOpen: (tool: BattleTool) => void;
  children?: ReactNode;
}) {
  const { openTool } = useOutletContext<CampaignLayoutContext>();
  const open = (tool: Entry["tool"]) => (tool === "dice" ? openTool("dice") : onOpen(tool));

  if (isMobile) {
    return (
      <BottomBar label="Battle tools">
        {PHONE.map((entry) => (
          <BottomBarButton
            key={entry.tool}
            label={entry.label}
            icon={entry.icon}
            aria-haspopup="dialog"
            className={entry.tool === "dice" ? "font-bold text-accent-hi" : undefined}
            onClick={() => open(entry.tool)}
          />
        ))}
      </BottomBar>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Battle tools">
      {WEB.map(({ tool, label, icon: Icon }) => (
        <Button key={tool} variant="secondary" onClick={() => open(tool)}>
          <Icon aria-hidden="true" /> {label}
        </Button>
      ))}
      {children}
    </div>
  );
}
