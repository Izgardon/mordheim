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
        backgroundImage: `radial-gradient(560px 400px at 4% 8%, rgba(92, 255, 118, 0.34), transparent 62%),
          radial-gradient(640px 460px at 96% 10%, rgba(76, 255, 132, 0.28), transparent 64%),
          radial-gradient(620px 440px at 10% 82%, rgba(70, 255, 124, 0.22), transparent 66%),
          radial-gradient(700px 500px at 92% 84%, rgba(72, 255, 128, 0.26), transparent 68%),
          radial-gradient(480px 320px at 50% 38%, rgba(124, 255, 156, 0.12), transparent 70%),
          radial-gradient(360px 220px at 34% 58%, rgba(92, 255, 118, 0.1), transparent 72%),
          linear-gradient(rgba(28, 24, 18, 0.08), rgba(16, 13, 10, 0.16)),
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
          <div className="desktop-shell__content-inner">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
