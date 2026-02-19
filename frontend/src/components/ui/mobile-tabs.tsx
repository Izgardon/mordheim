import { cn } from "@/lib/utils";

type TabOption<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type MobileTabsProps<T extends string> = {
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
  listClassName?: string;
};

export default function MobileTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  listClassName,
}: MobileTabsProps<T>) {
  return (
    <div className={cn("scrollbar-hidden w-full overflow-x-auto", className)}>
      <div
        className={cn(
          "flex min-w-max items-center gap-2 px-2 pb-1 pt-0.5",
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
                "shrink-0 rounded-full border border-[#3a2c20] bg-[#14110c]/80 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#e9dcc2] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-60",
                isActive && "border-[#6e5a3b] bg-[#2a2117] text-white shadow-[0_10px_18px_rgba(10,6,3,0.35)]"
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
