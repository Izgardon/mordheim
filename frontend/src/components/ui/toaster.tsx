import type { CSSProperties } from "react";
import { Toaster } from "sonner";

import { useTheme } from "@/lib/theme";

// Design E: a square panel with the accent line, ink text, and the danger and good tokens for
// errors and successes (rich colours). Sonner reads these variables; the classes below square its
// buttons, which it rounds itself.
const toasterStyle = {
  "--normal-bg": "var(--color-panel)",
  "--normal-border": "var(--color-accent-line)",
  "--normal-text": "var(--color-ink)",
  "--error-bg": "var(--color-danger-bg)",
  "--error-border": "var(--color-danger-line)",
  "--error-text": "var(--color-danger)",
  // the token is a see-through tint in the dark theme, which let the page's titles show through a
  // toast (William, 21 Nov 2026): mixed onto the panel it is solid in both themes
  "--success-bg": "color-mix(in srgb, var(--color-good) 12%, var(--color-panel))",
  "--success-border": "var(--color-good-line)",
  "--success-text": "var(--color-good)",
  "--border-radius": "0px",
  fontFamily: "var(--font-body)",
} as CSSProperties;

const toastClassNames = {
  toast: "!shadow-[0_16px_40px_var(--color-shadow)]",
  title: "!text-sm !font-bold",
  description: "!text-[13px] !text-text2",
  closeButton:
    "!rounded-none !border-border !bg-panel !text-text2 hover:!bg-raised hover:!text-head",
  actionButton: "!rounded-none !bg-primary !font-bold !text-on-accent",
  cancelButton: "!rounded-none !bg-raised !text-ink",
};

/** Mounted once at the app root; call `toast(...)` from "sonner" anywhere. Follows the theme. */
export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      style={toasterStyle}
      toastOptions={{ classNames: toastClassNames }}
    />
  );
}
