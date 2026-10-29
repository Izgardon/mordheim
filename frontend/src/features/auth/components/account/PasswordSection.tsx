// components
import { Button } from "@components/button";
import { AuthFormError } from "../AuthField";
import { PasswordField } from "../PasswordInput";
import { AccountSection } from "./AccountSection";

// hooks
import { usePasswordChange } from "../../hooks/use-account-sessions";

/** Change your password (AUTH-NEW-03): other devices are signed out, this one stays signed in. */
export function PasswordSection() {
  const form = usePasswordChange();

  return (
    <AccountSection
      title="Password"
      description="Your other devices are signed out when it changes. This one stays signed in."
    >
      <form className="space-y-3" onSubmit={form.submit}>
        <PasswordField
          label="Current password"
          value={form.currentPassword}
          onChange={form.setCurrentPassword}
          autoComplete="current-password"
          error={form.errors.current_password}
          className="mx-0"
        />
        <PasswordField
          label="New password"
          value={form.newPassword}
          onChange={form.setNewPassword}
          autoComplete="new-password"
          showRules
          error={form.errors.new_password}
          className="mx-0"
        />
        <AuthFormError message={form.error} />
        <Button type="submit" size="sm" disabled={form.isSaving}>
          {form.isSaving ? "Changing..." : "Change password"}
        </Button>
      </form>
    </AccountSection>
  );
}
