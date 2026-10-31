// components
import { Button } from "@components/button";
import { AuthFormError } from "../AuthField";
import { PasswordField } from "../PasswordInput";
import { ACCOUNT_FORM, AccountSection } from "./AccountSection";

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
      <form className={ACCOUNT_FORM} onSubmit={form.submit}>
        <PasswordField
          label="Current password"
          value={form.currentPassword}
          onChange={form.setCurrentPassword}
          autoComplete="current-password"
          error={form.errors.current_password}
        />
        <PasswordField
          label="New password"
          value={form.newPassword}
          onChange={form.setNewPassword}
          autoComplete="new-password"
          showRules
          error={form.errors.new_password}
        />
        <AuthFormError message={form.error} />
        <Button type="submit" disabled={form.isSaving}>
          {form.isSaving ? "Changing..." : "Change password"}
        </Button>
      </form>
    </AccountSection>
  );
}
