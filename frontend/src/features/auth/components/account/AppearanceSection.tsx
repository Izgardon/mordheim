// components
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AccountSection } from "./AccountSection";

// hooks
import { promptInstall, useInstallState } from "@/lib/install";
import { useTheme } from "@/lib/theme";

/**
 * Light or dark (William: "light mode can live in account"): the one place the theme is switched. Below it,
 * installing the app on a phone (William, 25 Nov 2026): Install where the browser offers it (Android), the way
 * to do it on an iPhone, and nothing once it is installed or where it can't be.
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const install = useInstallState();

  return (
    <AccountSection title="Appearance">
      <Switch
        look="plain"
        checked={theme === "light"}
        onCheckedChange={(light) => setTheme(light ? "light" : "dark")}
      >
        Light mode
      </Switch>
      {install === "prompt" ? (
        <Button variant="secondary" className="self-start" onClick={() => void promptInstall()}>
          Install the app
        </Button>
      ) : null}
      {install === "ios" ? (
        <p className="m-0 text-sm text-text2">
          To install the app: Share, then Add to Home Screen.
        </p>
      ) : null}
    </AccountSection>
  );
}
