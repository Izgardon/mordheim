import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

type AuthShellProps = {
  children: ReactNode;
  /**
   * The desktop half beside the card: Landing's background video (decision 5, AUTH-TWEAK-05).
   * Without one the half stays dark, so the reset page loads no video.
   */
  aside?: ReactNode;
};

/** The auth pages' frame: the card on its column, and on desktop a half beside it. */
export default function AuthShell({ children, aside }: AuthShellProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");

  return (
    <main className={cn("landing bg-page", isMobile && "landing--mobile")}>
      <section className="landing-auth">{children}</section>
      {!isMobile ? (aside ?? <section className="landing-video" aria-hidden="true" />) : null}
    </main>
  );
}
