// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
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
    >
      <Button variant="destructive" size="sm" onClick={deletion.openDialog}>
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
    <Dialog
      open={deletion.open}
      onOpenChange={(open) => (open ? undefined : deletion.closeDialog())}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
          <DialogDescription>
            What deleting your account does. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          {preview.isPending ? (
            <p>Checking your campaigns...</p>
          ) : preview.isError ? (
            <p className="text-red-600">
              {getErrorMessage(preview.error, "Couldn't check your campaigns.")}
            </p>
          ) : (
            <DeletionPreview preview={preview.data} />
          )}
          <p className="font-semibold text-foreground">This can&apos;t be undone.</p>
          {preview.data?.can_delete ? (
            <PasswordField
              label="Your password"
              value={deletion.password}
              onChange={deletion.setPassword}
              autoComplete="current-password"
              error={deletion.passwordError}
              className="mx-0"
            />
          ) : null}
          <AuthFormError message={deletion.error} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={deletion.closeDialog} disabled={deletion.isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={blocked || !deletion.password || deletion.isDeleting}
            onClick={() => void deletion.confirm()}
          >
            {deletion.isDeleting ? "Deleting..." : "Delete my account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
