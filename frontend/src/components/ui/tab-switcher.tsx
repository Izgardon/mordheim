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
        "flex flex-nowrap items-center gap-2 overflow-x-auto pb-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant={activeTab === tab.id ? "secondary" : "ghost"}
          size={size}
          onClick={() => onTabChange(tab.id)}
          disabled={tab.disabled}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
