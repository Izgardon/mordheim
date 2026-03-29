import { Button } from "@/components/ui/button";
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
          "flex min-w-max flex-nowrap items-center justify-center gap-2 overflow-visible px-0 py-2",
          listClassName
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              disabled={tab.disabled}
              variant="toolbar"
              size="sm"
              data-active={isActive}
              className="shrink-0"
            >
              {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
