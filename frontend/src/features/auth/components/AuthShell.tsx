import { DataCredit, Disclaimer } from "@/components/ui/disclaimer";
import { GameIconsCredit } from "@/components/ui/game-icons";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

type AuthShellProps = {
  children: ReactNode;
  /**
   * The web's picture half: Landing's background video (decision 5, AUTH-TWEAK-05). Without one
   * the half shows only the caption, so the reset page loads no video.
   */
  video?: ReactNode;
  /** Under the caption: the video's credit, where there is a video. */
  credit?: ReactNode;
};

/**
 * The sign-in and reset pages' frame (design E). On the web, the form's column on the panel and,
 * beside it, the picture half with a caption card; on a phone, the column alone. The page itself
 * never scrolls (body is overflow: hidden), so this box does: a long form scrolls rather than
 * being cut off (AUTH-UX-07), while the picture stays put.
 */
export default function AuthShell({ children, video, credit }: AuthShellProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");

  return (
    <main
      className={cn(
        "auth-page h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-page",
        isMobile
          ? "auth-page--phone"
          : "grid grid-cols-[minmax(440px,520px)_minmax(0,1fr)] items-start"
      )}
    >
      <section
        className={cn(
          "flex min-h-[100dvh] flex-col",
          isMobile
            ? "px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+32px)]"
            : "border-r border-line bg-panel px-14 py-12"
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-[400px] flex-1 flex-col gap-8",
            !isMobile && "justify-center"
          )}
        >
          {children}
          {/* A phone has no picture half: the caption closes the column instead. */}
          {isMobile ? (
            <AuthCaption className="mt-auto border-x-0 border-b-0 bg-transparent px-0 pb-0 pt-6">
              <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                <GameIconsCredit />
                <DataCredit />
                <Disclaimer />
              </div>
            </AuthCaption>
          ) : null}
        </div>
      </section>
      {isMobile ? null : (
        <div className="auth-aside sticky top-0 h-[100dvh] min-w-0 overflow-hidden bg-rail">
          {video}
          <AuthCaption className="absolute bottom-10 left-10 right-10 max-w-[460px]">
            {credit}
          </AuthCaption>
        </div>
      )}
    </main>
  );
}

/** The caption card over the picture half: the year and the line about the comet. */
function AuthCaption({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <figure className={cn("m-0 flex flex-col gap-3 border border-border bg-panel p-6", className)}>
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-accent-text">
        Imperial year 1999
      </span>
      <blockquote className="m-0 font-display text-[26px] font-semibold leading-snug text-head max-[960px]:text-xl">
        A comet fell on Mordheim. The city burned, and every warband in the Empire came for the
        shards.
      </blockquote>
      {children}
    </figure>
  );
}

/** A page's heading in the auth column: a kicker, the title and a line under it. */
export function AuthHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-accent-text">
        {kicker}
      </span>
      <h1 className="m-0 font-display text-[44px] font-semibold leading-[1.05] text-head max-[960px]:text-[34px]">
        {title}
      </h1>
      {children}
    </header>
  );
}
