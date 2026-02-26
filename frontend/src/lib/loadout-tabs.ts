export const LOADOUT_TABS = [
  { id: "items", label: "Items" },
  { id: "skills", label: "Skills" },
  { id: "spells", label: "Spells" },
  { id: "bestiary", label: "Bestiary" },
  { id: "hired-swords", label: "Hired Swords" },
] as const;

export type LoadoutTabId = (typeof LOADOUT_TABS)[number]["id"];
