import type { CSSProperties } from "react";

type BattleCardThemeKind =
  | "hero"
  | "henchman"
  | "henchmen_group"
  | "hired_sword"
  | "custom"
  | "bestiary";

type ThemeTokens = {
  battleCardBorder: string;
  battleCardBg: string;
  battleCardShadow: string;
  battleInlineBorder: string;
  battleInlineBg: string;
  battleInlineShadow: string;
  battleMetricBorder: string;
  battleMetricBg: string;
  battleMetricShadow: string;
  battleStatsBorder: string;
  battleStatsBg: string;
  battleStatsShadow: string;
  battleToolbarBorder: string;
  battleToolbarBg: string;
  battleToolbarHoverBorder: string;
  battleToolbarHoverBg: string;
  unitListPanelBorderRgb: string;
  unitListPanelBg: string;
  unitListHeading: string;
  unitListIcon: string;
  unitListTabBorderRgb: string;
  unitListTabBg: string;
  unitListTabHoverBg: string;
  unitListTabActiveBg: string;
  unitListTabColor: string;
  unitListTabActiveColor: string;
  unitListEntryBorderRgb: string;
  unitListEntryBg: string;
  unitListEntryHoverBg: string;
  unitListEntryText: string;
  unitListEntryMuted: string;
  unitListEntryIcon: string;
  unitListEntryIconStrong: string;
};

const DEFAULT_THEME: ThemeTokens = {
  battleCardBorder: "rgba(94, 73, 49, 0.94)",
  battleCardBg: "linear-gradient(180deg, rgba(21, 16, 11, 0.98), rgba(14, 10, 8, 0.98))",
  battleCardShadow: "0 18px 32px rgba(0, 0, 0, 0.22)",
  battleInlineBorder: "rgba(94, 73, 49, 0.9)",
  battleInlineBg: "rgba(21, 15, 11, 0.96)",
  battleInlineShadow: "0 14px 24px rgba(0, 0, 0, 0.16)",
  battleMetricBorder: "rgba(94, 73, 49, 0.9)",
  battleMetricBg: "rgba(24, 18, 13, 0.96)",
  battleMetricShadow: "0 14px 24px rgba(0, 0, 0, 0.16)",
  battleStatsBorder: "rgba(94, 73, 49, 0.9)",
  battleStatsBg: "linear-gradient(180deg, rgba(18, 14, 10, 0.98), rgba(13, 10, 8, 0.98))",
  battleStatsShadow: "0 14px 24px rgba(0, 0, 0, 0.16)",
  battleToolbarBorder: "rgba(94, 73, 49, 0.9)",
  battleToolbarBg: "rgba(21, 15, 11, 0.96)",
  battleToolbarHoverBorder: "rgba(134, 109, 79, 0.96)",
  battleToolbarHoverBg: "rgba(29, 22, 16, 0.98)",
  unitListPanelBorderRgb: "110, 90, 59",
  unitListPanelBg: "rgba(15, 11, 8, 0.86)",
  unitListHeading: "rgba(219, 198, 168, 0.82)",
  unitListIcon: "rgba(226, 206, 177, 0.88)",
  unitListTabBorderRgb: "110, 90, 59",
  unitListTabBg: "rgba(10, 8, 6, 0.72)",
  unitListTabHoverBg: "rgba(24, 18, 13, 0.92)",
  unitListTabActiveBg: "rgba(35, 26, 18, 0.96)",
  unitListTabColor: "rgba(205, 184, 153, 0.74)",
  unitListTabActiveColor: "rgba(247, 239, 223, 0.96)",
  unitListEntryBorderRgb: "158, 132, 96",
  unitListEntryBg: "rgba(27, 20, 14, 0.78)",
  unitListEntryHoverBg: "rgba(34, 25, 17, 0.92)",
  unitListEntryText: "rgba(245, 238, 225, 0.95)",
  unitListEntryMuted: "rgba(194, 175, 146, 0.78)",
  unitListEntryIcon: "rgba(207, 188, 160, 0.76)",
  unitListEntryIconStrong: "rgba(247, 239, 223, 0.96)",
};

const HERO_THEME: ThemeTokens = {
  battleCardBorder: "rgba(171, 142, 90, 0.66)",
  battleCardBg: "linear-gradient(180deg, rgba(27, 21, 14, 0.97), rgba(18, 14, 10, 0.98))",
  battleCardShadow: "0 18px 32px rgba(42, 29, 10, 0.14)",
  battleInlineBorder: "rgba(171, 142, 90, 0.56)",
  battleInlineBg: "rgba(28, 21, 14, 0.92)",
  battleInlineShadow: "0 14px 24px rgba(38, 26, 10, 0.11)",
  battleMetricBorder: "rgba(171, 142, 90, 0.5)",
  battleMetricBg: "rgba(31, 24, 16, 0.92)",
  battleMetricShadow: "0 14px 24px rgba(38, 26, 10, 0.11)",
  battleStatsBorder: "rgba(171, 142, 90, 0.54)",
  battleStatsBg: "linear-gradient(180deg, rgba(26, 20, 14, 0.95), rgba(18, 14, 10, 0.97))",
  battleStatsShadow: "0 14px 24px rgba(38, 26, 10, 0.11)",
  battleToolbarBorder: "rgba(171, 142, 90, 0.5)",
  battleToolbarBg: "rgba(27, 21, 14, 0.92)",
  battleToolbarHoverBorder: "rgba(194, 164, 109, 0.72)",
  battleToolbarHoverBg: "rgba(36, 27, 18, 0.96)",
  unitListPanelBorderRgb: "171, 142, 90",
  unitListPanelBg: "rgba(18, 14, 10, 0.84)",
  unitListHeading: "rgba(224, 202, 161, 0.82)",
  unitListIcon: "rgba(233, 214, 181, 0.86)",
  unitListTabBorderRgb: "171, 142, 90",
  unitListTabBg: "rgba(12, 10, 7, 0.74)",
  unitListTabHoverBg: "rgba(27, 21, 14, 0.9)",
  unitListTabActiveBg: "rgba(42, 31, 20, 0.94)",
  unitListTabColor: "rgba(220, 200, 166, 0.72)",
  unitListTabActiveColor: "rgba(246, 237, 220, 0.94)",
  unitListEntryBorderRgb: "171, 142, 90",
  unitListEntryBg: "rgba(29, 22, 15, 0.76)",
  unitListEntryHoverBg: "rgba(37, 28, 18, 0.88)",
  unitListEntryText: "rgba(252, 245, 231, 0.97)",
  unitListEntryMuted: "rgba(226, 205, 168, 0.8)",
  unitListEntryIcon: "rgba(233, 210, 166, 0.82)",
  unitListEntryIconStrong: "rgba(255, 245, 221, 0.98)",
};

const HENCHMEN_THEME: ThemeTokens = {
  battleCardBorder: "rgba(121, 129, 140, 0.66)",
  battleCardBg: "linear-gradient(180deg, rgba(18, 20, 25, 0.97), rgba(13, 15, 19, 0.98))",
  battleCardShadow: "0 18px 32px rgba(14, 17, 23, 0.14)",
  battleInlineBorder: "rgba(121, 129, 140, 0.54)",
  battleInlineBg: "rgba(19, 21, 25, 0.92)",
  battleInlineShadow: "0 14px 24px rgba(14, 17, 23, 0.11)",
  battleMetricBorder: "rgba(121, 129, 140, 0.48)",
  battleMetricBg: "rgba(23, 25, 30, 0.92)",
  battleMetricShadow: "0 14px 24px rgba(14, 17, 23, 0.11)",
  battleStatsBorder: "rgba(121, 129, 140, 0.52)",
  battleStatsBg: "linear-gradient(180deg, rgba(17, 19, 24, 0.96), rgba(13, 15, 19, 0.98))",
  battleStatsShadow: "0 14px 24px rgba(14, 17, 23, 0.11)",
  battleToolbarBorder: "rgba(121, 129, 140, 0.48)",
  battleToolbarBg: "rgba(19, 21, 25, 0.92)",
  battleToolbarHoverBorder: "rgba(151, 160, 172, 0.72)",
  battleToolbarHoverBg: "rgba(28, 31, 36, 0.96)",
  unitListPanelBorderRgb: "121, 129, 140",
  unitListPanelBg: "rgba(11, 12, 15, 0.86)",
  unitListHeading: "rgba(207, 214, 223, 0.82)",
  unitListIcon: "rgba(222, 228, 236, 0.86)",
  unitListTabBorderRgb: "121, 129, 140",
  unitListTabBg: "rgba(8, 9, 11, 0.74)",
  unitListTabHoverBg: "rgba(18, 20, 24, 0.9)",
  unitListTabActiveBg: "rgba(28, 31, 37, 0.94)",
  unitListTabColor: "rgba(198, 207, 217, 0.72)",
  unitListTabActiveColor: "rgba(238, 242, 247, 0.94)",
  unitListEntryBorderRgb: "121, 129, 140",
  unitListEntryBg: "rgba(19, 21, 25, 0.76)",
  unitListEntryHoverBg: "rgba(25, 28, 33, 0.88)",
  unitListEntryText: "rgba(244, 247, 250, 0.96)",
  unitListEntryMuted: "rgba(190, 199, 211, 0.78)",
  unitListEntryIcon: "rgba(206, 214, 224, 0.8)",
  unitListEntryIconStrong: "rgba(245, 248, 252, 0.98)",
};

const HIRED_SWORD_THEME: ThemeTokens = {
  battleCardBorder: "rgba(147, 104, 76, 0.68)",
  battleCardBg: "linear-gradient(180deg, rgba(26, 18, 14, 0.97), rgba(18, 13, 10, 0.98))",
  battleCardShadow: "0 18px 32px rgba(38, 22, 14, 0.14)",
  battleInlineBorder: "rgba(147, 104, 76, 0.56)",
  battleInlineBg: "rgba(27, 18, 14, 0.92)",
  battleInlineShadow: "0 14px 24px rgba(38, 22, 14, 0.11)",
  battleMetricBorder: "rgba(147, 104, 76, 0.5)",
  battleMetricBg: "rgba(31, 21, 16, 0.92)",
  battleMetricShadow: "0 14px 24px rgba(38, 22, 14, 0.11)",
  battleStatsBorder: "rgba(147, 104, 76, 0.54)",
  battleStatsBg: "linear-gradient(180deg, rgba(25, 17, 13, 0.96), rgba(18, 13, 10, 0.98))",
  battleStatsShadow: "0 14px 24px rgba(38, 22, 14, 0.11)",
  battleToolbarBorder: "rgba(147, 104, 76, 0.5)",
  battleToolbarBg: "rgba(27, 18, 14, 0.92)",
  battleToolbarHoverBorder: "rgba(176, 130, 98, 0.74)",
  battleToolbarHoverBg: "rgba(35, 23, 17, 0.96)",
  unitListPanelBorderRgb: "147, 104, 76",
  unitListPanelBg: "rgba(15, 11, 9, 0.86)",
  unitListHeading: "rgba(219, 180, 151, 0.84)",
  unitListIcon: "rgba(229, 194, 170, 0.88)",
  unitListTabBorderRgb: "147, 104, 76",
  unitListTabBg: "rgba(9, 7, 6, 0.74)",
  unitListTabHoverBg: "rgba(24, 17, 13, 0.9)",
  unitListTabActiveBg: "rgba(39, 26, 18, 0.94)",
  unitListTabColor: "rgba(214, 183, 161, 0.72)",
  unitListTabActiveColor: "rgba(246, 233, 223, 0.94)",
  unitListEntryBorderRgb: "147, 104, 76",
  unitListEntryBg: "rgba(27, 18, 14, 0.76)",
  unitListEntryHoverBg: "rgba(35, 23, 17, 0.88)",
  unitListEntryText: "rgba(249, 239, 231, 0.96)",
  unitListEntryMuted: "rgba(212, 180, 156, 0.78)",
  unitListEntryIcon: "rgba(223, 184, 152, 0.82)",
  unitListEntryIconStrong: "rgba(252, 236, 220, 0.98)",
};

function getThemeTokens(kind: BattleCardThemeKind): ThemeTokens {
  if (kind === "hero") {
    return HERO_THEME;
  }
  if (kind === "henchman" || kind === "henchmen_group") {
    return HENCHMEN_THEME;
  }
  if (kind === "hired_sword") {
    return HIRED_SWORD_THEME;
  }
  return DEFAULT_THEME;
}

export function getBattleCardThemeStyle(kind: BattleCardThemeKind): CSSProperties {
  const tokens = getThemeTokens(kind);

  return {
    "--battle-card-border": tokens.battleCardBorder,
    "--battle-card-bg": tokens.battleCardBg,
    "--battle-card-shadow": tokens.battleCardShadow,
    "--battle-inline-border": tokens.battleInlineBorder,
    "--battle-inline-bg": tokens.battleInlineBg,
    "--battle-inline-shadow": tokens.battleInlineShadow,
    "--battle-metric-border": tokens.battleMetricBorder,
    "--battle-metric-bg": tokens.battleMetricBg,
    "--battle-metric-shadow": tokens.battleMetricShadow,
    "--battle-stats-border": tokens.battleStatsBorder,
    "--battle-stats-bg": tokens.battleStatsBg,
    "--battle-stats-shadow": tokens.battleStatsShadow,
    "--battle-toolbar-border": tokens.battleToolbarBorder,
    "--battle-toolbar-bg": tokens.battleToolbarBg,
    "--battle-toolbar-hover-border": tokens.battleToolbarHoverBorder,
    "--battle-toolbar-hover-bg": tokens.battleToolbarHoverBg,
    "--unit-list-panel-border-rgb": tokens.unitListPanelBorderRgb,
    "--unit-list-panel-bg": tokens.unitListPanelBg,
    "--unit-list-heading": tokens.unitListHeading,
    "--unit-list-icon": tokens.unitListIcon,
    "--unit-list-tab-border-rgb": tokens.unitListTabBorderRgb,
    "--unit-list-tab-bg": tokens.unitListTabBg,
    "--unit-list-tab-hover-bg": tokens.unitListTabHoverBg,
    "--unit-list-tab-active-bg": tokens.unitListTabActiveBg,
    "--unit-list-tab-color": tokens.unitListTabColor,
    "--unit-list-tab-active-color": tokens.unitListTabActiveColor,
    "--unit-list-entry-border-rgb": tokens.unitListEntryBorderRgb,
    "--unit-list-entry-bg": tokens.unitListEntryBg,
    "--unit-list-entry-hover-bg": tokens.unitListEntryHoverBg,
    "--unit-list-entry-text": tokens.unitListEntryText,
    "--unit-list-entry-muted": tokens.unitListEntryMuted,
    "--unit-list-entry-icon": tokens.unitListEntryIcon,
    "--unit-list-entry-icon-strong": tokens.unitListEntryIconStrong,
  } as CSSProperties;
}
