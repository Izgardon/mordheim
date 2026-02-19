import { Home, Briefcase, Swords, BookOpen, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

type WarbandMobileNavItem = {
  id: "overview" | "loadout" | "warband" | "rules" | "settings";
  label: string;
  icon: typeof Home;
  isCenter?: boolean;
};

const navItems: WarbandMobileNavItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "loadout", label: "Loadout", icon: Briefcase },
  { id: "warband", label: "Warband", icon: Swords, isCenter: true },
  { id: "rules", label: "Rules", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

type WarbandMobileNavProps = {
  activeId?: WarbandMobileNavItem["id"];
  onSelect?: (id: WarbandMobileNavItem["id"]) => void;
  className?: string;
};

export default function WarbandMobileNav({
  activeId = "warband",
  onSelect,
  className,
}: WarbandMobileNavProps) {
  return (
    <nav
      aria-label="Warband navigation"
      className={cn(
        "pointer-events-auto fixed inset-x-0 bottom-0 z-40 w-full",
        className
      )}
    >
      <div
        className="relative w-full rounded-none border-t border-[#3b2f25] bg-[#1f1813]/95 px-4 pt-2 shadow-[0_18px_40px_rgba(12,10,9,0.55)] backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <ul className="flex items-end justify-between gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            const isCenter = Boolean(item.isCenter);
            return (
              <li key={item.id} className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => onSelect?.(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex flex-col items-center gap-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#cdbca8] transition",
                    isActive && "text-[#f5e6c8]",
                    !isCenter && "pb-1"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-2xl border border-transparent bg-[#2a211a] text-[#d8c7b2] shadow-[0_6px_16px_rgba(8,6,4,0.4)] transition group-hover:translate-y-[-1px] group-hover:brightness-110",
                      isActive && "border-[#b99b6b] text-[#f6e4c0]",
                      isCenter
                        ? "h-12 w-12 -translate-y-4 border-[#8c6a42] bg-[#3b2a1b] text-[#f6e4c0] shadow-[0_18px_30px_rgba(8,6,4,0.5)]"
                        : "h-8 w-8"
                    )}
                  >
                    <Icon className={cn(isCenter ? "h-5 w-5" : "h-4 w-4")} />
                  </span>
                  <span className={cn(isCenter && "-mt-1")}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
