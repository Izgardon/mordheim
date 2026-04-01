export const HELPER_DIALOG_CONTENT_CLASS =
  "!rounded-none border-[#6b4c2d] bg-[#140e0a] " +
  "min-[960px]:!rounded-none min-[960px]:border-[#6b4c2d] min-[960px]:bg-[#140e0a] " +
  "[&_[class*='rounded-']]:!rounded-none [&_h2]:text-[#ecd7ac] [&_.text-muted-foreground]:text-[#baa382] " +
  "[&_.battle-inline-panel]:border [&_.battle-inline-panel]:border-[#5a3f24] " +
  "[&_.battle-inline-panel]:bg-[#1a120c] " +
  "[&_.battle-inline-panel]:shadow-[inset_0_1px_0_rgba(255,231,188,0.05),inset_0_0_0_1px_rgba(64,43,24,0.75)] " +
  "[&_.battle-metric-box]:border [&_.battle-metric-box]:border-[#8a6540] " +
  "[&_.battle-metric-box]:bg-[#3a2716] " +
  "[&_.battle-metric-box]:shadow-[0_6px_14px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,232,194,0.07),inset_0_0_0_1px_rgba(86,58,30,0.8)] " +
  "[&_.battle-stats-shell]:border [&_.battle-stats-shell]:border-[#5a3f24] " +
  "[&_.battle-stats-shell]:bg-[#14100c] [&_.battle-stats-shell]:!rounded-none " +
  "[&_.warband-hero-stats-wrapper]:!rounded-none [&_.warband-hero-stats-table]:!rounded-none " +
  "[&_.field-surface]:border-[#5a3f24] [&_.field-surface]:bg-[#130d09] [&_.field-surface]:text-foreground " +
  "[&_input]:!rounded-none [&_select]:border-[#5a3f24] [&_select]:bg-[#130d09] [&_select]:text-foreground " +
  "[&_option]:bg-[#130d09] [&_option]:text-foreground";

export const HELPER_NATIVE_SELECT_CLASS =
  "field-surface h-9 w-full rounded-none border border-[#4a3828] bg-[#090705] px-2 text-sm text-foreground outline-none focus:border-primary/60";

export const HELPER_NATIVE_SELECT_STYLE = {
  backgroundColor: "#090705",
  color: "hsl(var(--foreground))",
};

export const HELPER_RADIX_SELECT_TRIGGER_CLASS =
  "!rounded-none border-[#4a3828] bg-[#090705]";

export const HELPER_RADIX_SELECT_CONTENT_CLASS =
  "!rounded-none overflow-hidden border-[#4a3828] bg-[#090705] [&_[data-radix-select-viewport]]:!rounded-none [&_[data-radix-select-viewport]]:p-0";

export const HELPER_RADIX_SELECT_ITEM_CLASS =
  "!rounded-none focus:bg-[#18120d] focus:text-foreground";
