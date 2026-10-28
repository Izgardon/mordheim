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
import { AuthFormError, DisplayNameField } from "./AuthField";

// hooks
import { useAuth } from "../hooks/use-auth";
import { useDisplayNameForm } from "../hooks/use-display-name-form";

// types
import type { AuthUser } from "../types/auth-types";

const stayOpen = (event: Event) => event.preventDefault();

/**
 * Asked once for a display name (AUTH-NEW-06, decision 2): a signed-in user without one gets
 * this over the next screen. Sign-up requires a name, so only accounts made another way
 * (createsuperuser, the seeders) see it. It has no Skip and doesn't close, since the name is
 * required; until it's saved, others see "Player N".
 */
export function DisplayNamePrompt() {
  const { user } = useAuth();
  if (!user || user.name?.trim()) {
    return null;
  }
  return <DisplayNameDialog user={user} />;
}

function DisplayNameDialog({ user }: { user: AuthUser }) {
  const form = useDisplayNameForm("");

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-[440px]"
        onEscapeKeyDown={stayOpen}
        onInteractOutside={stayOpen}
      >
        <DialogHeader>
          <DialogTitle>Choose a display name</DialogTitle>
          <DialogDescription>The name other players see.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {`This is the name other players see in your campaigns, chat and battles. Until you choose one, they see "Player ${user.id}".`}
        </p>
        <form className="space-y-4" onSubmit={form.save}>
          <DisplayNameField
            value={form.name}
            onChange={form.setName}
            error={form.nameError}
            className="mx-0"
          />
          <AuthFormError message={form.error} />
          <DialogFooter>
            <Button type="submit" size="sm" disabled={form.isSaving}>
              {form.isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
