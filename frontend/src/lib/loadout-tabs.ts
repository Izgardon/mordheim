import { Book, PawPrint, Shield, Sparkles } from "lucide-react";

export const LOADOUT_TABS = [
  { id: "items", label: "Items", icon: Shield },
  { id: "skills", label: "Skills", icon: Book },
  { id: "spells", label: "Spells", icon: Sparkles },
  { id: "bestiary", label: "Bestiary", icon: PawPrint },
  { id: "hired-swords", label: "Hired Swords", icon: PawPrint },
] as const;

export type LoadoutTabId = (typeof LOADOUT_TABS)[number]["id"];
