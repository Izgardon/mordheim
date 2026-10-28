import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import siteBackground from "@/assets/background/site_background.webp";

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
    <main
      className={cn("landing", isMobile && "landing--mobile")}
      style={
        isMobile
          ? {
              backgroundImage: `radial-gradient(420px 320px at 0% 0%, rgba(57, 255, 77, 0.18), transparent 60%),
                radial-gradient(520px 380px at 100% 0%, rgba(57, 255, 77, 0.14), transparent 62%),
                radial-gradient(520px 380px at 0% 100%, rgba(57, 255, 77, 0.12), transparent 62%),
                radial-gradient(520px 380px at 100% 100%, rgba(57, 255, 77, 0.16), transparent 62%),
                linear-gradient(rgba(6, 5, 4, 0.25), rgba(6, 5, 4, 0.25)),
                url(${siteBackground})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundAttachment: "scroll",
            }
          : undefined
      }
    >
      <section className="landing-auth">{children}</section>
      {!isMobile ? (aside ?? <section className="landing-video" aria-hidden="true" />) : null}
    </main>
  );
}
