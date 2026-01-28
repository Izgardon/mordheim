import { Button, type ButtonProps } from "./button";
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
  size?: ButtonProps["size"];
};

export default function TabSwitcher<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  size = "default",
}: TabSwitcherProps<T>) {
  return (
    <div
      className={cn(
        "rpg-tabs-frame flex max-w-[90%] flex-nowrap items-center justify-center gap-2 overflow-x-auto px-4 py-3",
        className
      )}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="rpgFrame"
          size={size}
          onClick={() => onTabChange(tab.id)}
          disabled={tab.disabled}
          className={cn(
            "transition",
            activeTab === tab.id ? "brightness-110" : "text-[#e3d2b2]"
          )}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
