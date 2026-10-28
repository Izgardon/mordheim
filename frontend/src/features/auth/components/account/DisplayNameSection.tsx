import { toast } from "sonner";

// components
import { Button } from "@components/button";
import { AuthFormError, DisplayNameField } from "../AuthField";
import { AccountSection } from "./AccountSection";

// hooks
import { useDisplayNameForm } from "../../hooks/use-display-name-form";

// types
import type { AuthUser } from "../../types/auth-types";

/** Change your display name (AUTH-NEW-02): it shows everywhere at once, chat and bulletin included. */
export function DisplayNameSection({ user }: { user: AuthUser }) {
  const form = useDisplayNameForm(user.name ?? "", () => toast("Display name saved."));
  const isUnchanged = form.name.trim() === (user.name ?? "").trim();

  return (
    <AccountSection
      title="Display name"
      description="The name other players see in your campaigns, chat and battles."
    >
      <form className="space-y-3" onSubmit={form.save}>
        <DisplayNameField
          value={form.name}
          onChange={form.setName}
          error={form.nameError}
          className="mx-0"
        />
        <AuthFormError message={form.error} />
        <Button type="submit" size="sm" disabled={form.isSaving || isUnchanged}>
          {form.isSaving ? "Saving..." : "Save name"}
        </Button>
      </form>
    </AccountSection>
  );
}
