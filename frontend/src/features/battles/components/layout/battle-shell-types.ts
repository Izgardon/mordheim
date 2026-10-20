import type { ReactNode } from "react";

import type { ButtonProps } from "@/components/ui/button";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

type BattleMobileOption = {
  value: string;
  label: string;
};

export type BattleMobileTopBarConfig = {
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

export type BattleMobileBottomBarConfig = {
  primaryAction?: BattleMobileAction;
  secondaryAction?: BattleMobileAction;
};

/** The outlet context of the battle pages: the campaign's, plus the phone bars' setters. */
export type BattleLayoutContext = CampaignLayoutContext & {
  setBattleMobileTopBar?: (config: BattleMobileTopBarConfig | null) => void;
  setBattleMobileBottomBar?: (config: BattleMobileBottomBarConfig | null) => void;
};
