import { cn } from "@/lib/utils";

import tabSelected from "@/assets/components/tab_button_selected.webp";
import tabUnselected from "@/assets/components/tab_button_unselected.webp";

type TabOption<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type TabSwitcherProps<T extends string> = {
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
  listClassName?: string;
};

export default function TabSwitcher<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  listClassName,
}: TabSwitcherProps<T>) {
  return (
    <div className={cn("w-full max-w-full overflow-x-auto overflow-y-hidden sm:w-auto", className)}>
      <div
        className={cn(
          "flex min-w-max flex-nowrap items-center justify-center gap-0 overflow-visible px-0 py-2",
          listClassName
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                "nav-button shrink-0 bg-transparent px-8 py-3 font-display text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-foreground transition-all duration-150 hover:brightness-110 disabled:pointer-events-none disabled:opacity-70",
                isActive && "button-active"
              )}
              style={{
                backgroundImage: `url(${isActive ? tabSelected : tabUnselected})`,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
