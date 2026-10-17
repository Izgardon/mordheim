import { describe, expect, it } from "vitest";

import { resolveWarbandLink } from "./warband-link";

describe("resolveWarbandLink (SEC-14)", () => {
  it("embeds a Google Drive file through its preview page", () => {
    expect(resolveWarbandLink("https://drive.google.com/file/d/abc_123/view?usp=sharing")).toEqual({
      url: "https://drive.google.com/file/d/abc_123/view?usp=sharing",
      href: "https://drive.google.com/file/d/abc_123/view?usp=sharing",
      embedUrl: "https://drive.google.com/file/d/abc_123/preview",
      isGoogleDoc: false,
    });
  });

  it("embeds Google Docs, Sheets and Slides, keeping a Docs tab", () => {
    const doc = resolveWarbandLink("docs.google.com/document/d/D0c-1/edit?tab=t.2");
    expect(doc.embedUrl).toBe("https://docs.google.com/document/d/D0c-1/preview?tab=t.2");
    expect(doc.isGoogleDoc).toBe(true);
    expect(resolveWarbandLink("https://docs.google.com/spreadsheets/d/S1/edit").embedUrl).toBe(
      "https://docs.google.com/spreadsheets/d/S1/preview"
    );
    expect(resolveWarbandLink("https://docs.google.com/presentation/d/P1/edit").embedUrl).toBe(
      "https://docs.google.com/presentation/d/P1/preview"
    );
  });

  it("embeds YouTube videos without tracking cookies", () => {
    const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
    expect(resolveWarbandLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ").embedUrl).toBe(embed);
    expect(resolveWarbandLink("https://youtu.be/dQw4w9WgXcQ").embedUrl).toBe(embed);
    expect(resolveWarbandLink("https://m.youtube.com/shorts/dQw4w9WgXcQ").embedUrl).toBe(embed);
  });

  it("offers any other site as a plain link, never in a frame", () => {
    for (const url of [
      "https://example.com/roster.pdf",
      "https://docs.google.com.evil.example/document/d/x/edit",
      "https://evil.example/file/d/abc/view",
      "https://drive.google.com/drive/folders/abc",
    ]) {
      const link = resolveWarbandLink(url);
      expect(link.embedUrl).toBeNull();
      expect(link.href).toBe(url);
    }
  });

  it("never turns a non-web scheme into a link", () => {
    const link = resolveWarbandLink("javascript://%0Aalert(document.cookie)");

    expect(link.embedUrl).toBeNull();
    expect(link.href).toBeNull();
  });
});
