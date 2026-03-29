import type { ReactNode } from "react";

import siteBackground from "@/assets/background/site_background.webp";

type DesktopLayoutProps = {
  navbar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
};

export default function DesktopLayout({
  navbar,
  topBar,
  children,
}: DesktopLayoutProps) {
  return (
    <main
      className="desktop-shell"
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
      <aside className="desktop-shell__rail">
        {navbar}
      </aside>
      <div className="desktop-shell__topbar">
        {topBar}
      </div>
      <div className="desktop-shell__main">
        <div className="desktop-shell__content">
          {children}
        </div>
      </div>
    </main>
  );
}
