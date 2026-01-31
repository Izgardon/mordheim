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
    <div className={cn(" w-full max-w-full overflow-hidden sm:w-auto sm:max-w-[90%]", className)}>
      <div className="flex flex-nowrap items-center justify-start gap-2 overflow-x-auto overflow-y-hidden px-6 py-3 before:flex-shrink-0 before:content-[''] before:w-2 after:flex-shrink-0 after:content-[''] after:w-2 sm:before:w-3 sm:after:w-3">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? "default" : "secondary"}
            size={size}
            onClick={() => onTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn("shrink-0 transition", activeTab === tab.id && "button-active")}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
