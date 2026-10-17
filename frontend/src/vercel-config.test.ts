import { describe, expect, it } from "vitest";

import vercel from "../vercel.json";

type Route = {
  src?: string;
  dest?: string;
  handle?: string;
  headers?: Record<string, string>;
  continue?: boolean;
};

const routes = vercel.routes as Route[];
const securityHeaders = routes[0]?.headers ?? {};
const csp = securityHeaders["Content-Security-Policy-Report-Only"] ?? "";
const directive = (name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? "";

describe("vercel.json", () => {
  it("keeps the routes valid: headers continue, then the filesystem, then the SPA fallback", () => {
    expect(routes[0]).toMatchObject({ src: "/(.*)", continue: true });
    expect(routes.findIndex((route) => route.handle === "filesystem")).toBe(routes.length - 2);
    expect(routes[routes.length - 1]).toEqual({ src: "/.*", dest: "/index.html" });
  });

  it("sends the security headers on every response (SEC-15)", () => {
    expect(securityHeaders).toMatchObject({
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    // Report-only until it has been watched in production; it must not be enforced yet.
    expect(securityHeaders).not.toHaveProperty("Content-Security-Policy");
  });

  it("lets the CSP through for the app's real origins", () => {
    expect(directive("script-src")).toContain("'wasm-unsafe-eval'"); // dice-box physics (Ammo)
    expect(directive("connect-src")).toContain("https://mordheim-1.onrender.com");
    expect(directive("connect-src")).toContain("wss://*.pusher.com");
    expect(directive("worker-src")).toContain("blob:");
    expect(directive("img-src")).toContain("data:");
    expect(directive("style-src")).toContain("https://fonts.googleapis.com");
    expect(directive("font-src")).toContain("https://fonts.gstatic.com");
  });
});
