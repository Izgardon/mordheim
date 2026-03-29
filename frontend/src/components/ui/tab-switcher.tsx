import { cn } from "@/lib/utils";

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
                "nav-button shrink-0 px-4 py-2 font-display text-[0.6rem] font-semibold uppercase tracking-[0.25em] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-60",
                isActive && "button-active"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
