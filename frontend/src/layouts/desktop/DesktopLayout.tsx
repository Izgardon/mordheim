import type { ReactNode } from "react";

import siteBackground from "@/assets/background/site_background.png";
import { CardBackground } from "@/components/ui/card-background";

type DesktopLayoutProps = {
  navbar: ReactNode;
  children: ReactNode;
};

export default function DesktopLayout({ navbar, children }: DesktopLayoutProps) {
  return (
    <main
      className="desktop-layout bg-transparent"
      style={{
        backgroundImage: `url(${siteBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <CardBackground as="aside" className="desktop-layout__nav">
        {navbar}
      </CardBackground>
      <div className="desktop-layout__main">
        <div className="desktop-layout__content flex min-h-0 flex-1 flex-col gap-6">
          {children}
        </div>
      </div>
    </main>
  );
}
