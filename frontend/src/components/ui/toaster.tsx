import type { CSSProperties } from "react";
import { Toaster } from "sonner";

// Toasts take the card surface and border tokens, so they read as part of the app.
const toasterStyle = {
  "--normal-bg": "hsl(var(--card))",
  "--normal-border": "hsl(var(--border))",
  "--normal-text": "hsl(var(--foreground))",
} as CSSProperties;

/** Mounted once at the app root; call `toast(...)` from "sonner" anywhere. */
export function AppToaster() {
  return <Toaster theme="dark" position="top-center" closeButton style={toasterStyle} />;
}
