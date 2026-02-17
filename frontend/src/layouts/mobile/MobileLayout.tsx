import type { ReactNode } from "react";

import siteBackground from "@/assets/background/site_background.webp";
import { cn } from "@/lib/utils";

type MobileLayoutProps = {
  bottomNav?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function MobileLayout({
  bottomNav,
  children,
  className,
  contentClassName,
}: MobileLayoutProps) {
  const contentPaddingBottom = bottomNav
    ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)"
    : "env(safe-area-inset-bottom, 0px)";

  return (
    <main
      className={cn("fixed inset-0 flex flex-col overflow-hidden bg-transparent", className)}
      style={{
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
      }}
    >
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-6",
          contentClassName
        )}
        style={{ paddingBottom: contentPaddingBottom }}
      >
        {children}
      </div>
      {bottomNav}
    </main>
  );
}
