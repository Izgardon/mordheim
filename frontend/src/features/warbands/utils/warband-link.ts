import { normalizeWebUrl } from "@/lib/url-utils";

/**
 * Where a warband link may be shown inside the app (SEC-14). Only YouTube and Google
 * Drive/Docs are embedded, in a sandboxed frame; any other link opens in a new tab instead.
 */
export type WarbandLink = {
  /** The link as typed, with https:// added when it had no scheme. */
  url: string;
  /** The link to open in a new tab: http(s) only, else null (shown as text). */
  href: string | null;
  /** The embeddable address on a known host, or null to show a plain link. */
  embedUrl: string | null;
  isGoogleDoc: boolean;
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YOUTUBE_ID = /^[\w-]{6,20}$/;
const DOC_ID = /^[\w-]+$/;
const DOC_KINDS = new Set(["document", "spreadsheets", "presentation"]);

const parse = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

function youtubeEmbed(parsed: URL): string | null {
  const id =
    parsed.hostname === "youtu.be"
      ? parsed.pathname.slice(1)
      : parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
  return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

function googleEmbed(parsed: URL): string | null {
  if (parsed.hostname === "drive.google.com") {
    const id = parsed.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    return id && DOC_ID.test(id) ? `https://drive.google.com/file/d/${id}/preview` : null;
  }
  const [, kind, d, id] = parsed.pathname.split("/");
  if (!DOC_KINDS.has(kind) || d !== "d" || !id || !DOC_ID.test(id)) {
    return null;
  }
  const tab = parsed.searchParams.get("tab");
  const tabParam = tab ? `?tab=${encodeURIComponent(tab)}` : "";
  return `https://docs.google.com/${kind}/d/${id}/preview${tabParam}`;
}

export function resolveWarbandLink(rawUrl: string): WarbandLink {
  const url = normalizeWebUrl(rawUrl);
  const parsed = parse(url);
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    return { url, href: null, embedUrl: null, isGoogleDoc: false };
  }
  const host = parsed.hostname;
  const isGoogleDoc = host === "docs.google.com" && parsed.pathname.startsWith("/document/d/");
  const embedUrl =
    YOUTUBE_HOSTS.has(host) || host === "youtu.be"
      ? youtubeEmbed(parsed)
      : host === "drive.google.com" || host === "docs.google.com"
        ? googleEmbed(parsed)
        : null;
  return { url, href: parsed.href, embedUrl, isGoogleDoc };
}

/** What an embedded viewer may do: run its own scripts, open links in new tabs, go fullscreen. */
export const WARBAND_LINK_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation";
export const WARBAND_LINK_ALLOW = "fullscreen; encrypted-media; picture-in-picture";
