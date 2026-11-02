// components
import { Switch } from "@/components/ui/switch";
import { AccountSection } from "./AccountSection";

// hooks
import { useTheme } from "@/lib/theme";

/** Light or dark (William: "light mode can live in account"): the one place the theme is switched. */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <AccountSection title="Appearance">
      <Switch
        look="plain"
        checked={theme === "light"}
        onCheckedChange={(light) => setTheme(light ? "light" : "dark")}
      >
        Light mode
      </Switch>
    </AccountSection>
  );
}
