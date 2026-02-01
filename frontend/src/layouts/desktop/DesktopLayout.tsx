import type { ReactNode } from "react";

import siteBackground from "@/assets/background/site_background.png";
import { ScrollBackground } from "@/components/ui/scroll-background";

type DesktopLayoutProps = {
  navbar: ReactNode;
  children: ReactNode;
};

export default function DesktopLayout({ navbar, children }: DesktopLayoutProps) {
  return (
    <main
      className="desktop-layout bg-transparent"
      style={{
        backgroundImage: `linear-gradient(rgba(6, 5, 4, 0.25), rgba(6, 5, 4, 0.25)), url(${siteBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <aside className="desktop-layout__nav">
        {navbar}
      </aside>
      <div className="desktop-layout__main">
        <ScrollBackground className="desktop-layout__content">
          {children}
        </ScrollBackground>
      </div>
    </main>
  );
}
