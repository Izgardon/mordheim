import { toast } from "sonner";

import type { ServerWarning } from "../types/companion-types";

/**
 * What the server warned about while a change went ahead (a guide, not a gatekeeper): one toast
 * per code, so a repeated warning replaces the one on screen rather than stacking.
 */
export function toastServerWarnings(warnings: ServerWarning[] = []) {
  for (const warning of warnings) {
    toast.warning(warning.message, { id: `server-warning-${warning.code}` });
  }
}
