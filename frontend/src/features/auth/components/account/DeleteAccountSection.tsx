// components
import { Button } from "@components/button";
import { ModalSheet } from "@components/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";
import { AuthFormError } from "../AuthField";
import { PasswordField } from "../PasswordInput";
import { AccountSection } from "./AccountSection";
import { DeletionPreview } from "./DeletionPreview";

// hooks
import { useAccountDeletion, type AccountDeletionState } from "../../hooks/use-account-deletion";

/**
 * Delete your account (AUTH-NEW-05, decision 1): a preview, then the password; owned campaigns
 * with members are handed over first, and it can't be undone.
 */
export function DeleteAccountSection() {
  const deletion = useAccountDeletion();

  return (
    <AccountSection
      title="Delete account"
      description="Your warbands stay in their campaigns as retired records, shown as Former player. This can't be undone."
      tone="danger"
    >
      <Button variant="danger" onClick={deletion.openDialog}>
        Delete account
      </Button>
      <DeleteAccountDialog deletion={deletion} />
    </AccountSection>
  );
}

function DeleteAccountDialog({ deletion }: { deletion: AccountDeletionState }) {
  const { preview } = deletion;
  const blocked = preview.data ? !preview.data.can_delete : true;

  return (
    <ModalSheet
      open={deletion.open}
      onOpenChange={(open) => (open ? undefined : deletion.closeDialog())}
      kicker="Account"
      title="Delete your account"
      description="What deleting your account does. This can't be undone."
      className="max-w-[560px]"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
          <Button
            variant="secondary"
            className="min-h-12"
            onClick={deletion.closeDialog}
            disabled={deletion.isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="min-h-12"
            disabled={blocked || !deletion.password || deletion.isDeleting}
            onClick={() => void deletion.confirm()}
          >
            {deletion.isDeleting ? "Deleting..." : "Delete my account"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-text2">
        {preview.isPending ? (
          <p className="m-0">Checking your campaigns...</p>
        ) : preview.isError ? (
          <p className="m-0 text-danger">
            {getErrorMessage(preview.error, "Couldn't check your campaigns.")}
          </p>
        ) : (
          <DeletionPreview preview={preview.data} />
        )}
        <p className="m-0 border-l-2 border-danger-line pl-3 font-bold text-danger">
          This can&apos;t be undone.
        </p>
        {preview.data?.can_delete ? (
          <PasswordField
            label="Your password"
            value={deletion.password}
            onChange={deletion.setPassword}
            autoComplete="current-password"
            error={deletion.passwordError}
          />
        ) : null}
        <AuthFormError message={deletion.error} />
      </div>
    </ModalSheet>
  );
}
