import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type TabOption<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
  icon?: LucideIcon;
};

type MobileTabsProps<T extends string> = {
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
  listClassName?: string;
  showDivider?: boolean;
};

export default function MobileTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  listClassName,
  showDivider = false,
}: MobileTabsProps<T>) {
  return (
    <div className={cn(showDivider && "border-b border-border/60 pb-2", className)}>
      <div className="scrollbar-hidden w-full overflow-x-auto">
        <div
          className={cn(
            "flex min-w-max items-center gap-2 px-2 pb-1 pt-0.5",
            listClassName
          )}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border border-[#3a2c20] bg-[#14110c]/80 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#e9dcc2] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-60",
                  isActive && "border-[#6e5a3b] bg-[#2a2117] text-white shadow-[0_10px_18px_rgba(10,6,3,0.35)]"
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
