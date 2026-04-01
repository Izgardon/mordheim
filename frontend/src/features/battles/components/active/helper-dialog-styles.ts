export const HELPER_DIALOG_CONTENT_CLASS =
  "!rounded-none bg-[#090705] min-[960px]:!rounded-none min-[960px]:bg-[#090705] " +
  "[&_[class*='rounded-']]:!rounded-none [&_.battle-inline-panel]:border-[#4a3828] [&_.battle-inline-panel]:bg-[#090705] " +
  "[&_.battle-metric-box]:border-[#4a3828] [&_.battle-metric-box]:bg-[#090705] [&_.battle-stats-shell]:border-[#4a3828] " +
  "[&_.battle-stats-shell]:bg-[#090705] [&_.battle-stats-shell]:!rounded-none [&_.warband-hero-stats-wrapper]:!rounded-none " +
  "[&_.warband-hero-stats-table]:!rounded-none [&_.field-surface]:border-[#4a3828] [&_.field-surface]:bg-[#090705] " +
  "[&_.field-surface]:text-foreground [&_input]:!rounded-none [&_select]:border-[#4a3828] [&_select]:bg-[#090705] " +
  "[&_select]:text-foreground [&_option]:bg-[#090705] [&_option]:text-foreground";

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
