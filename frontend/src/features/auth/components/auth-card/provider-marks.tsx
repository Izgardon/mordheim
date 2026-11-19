/**
 * Each provider's mark, drawn inline. No remote image or script: the CSP serves scripts and
 * images from the app alone, and a provider-hosted button would need `script-src` opened up.
 *
 * A provider with no mark here still gets its button, with no icon.
 */
const MARKS: Record<string, { path: string; viewBox: string }> = {
  google: {
    viewBox: "0 0 24 24",
    path: "M12 11v2.4h5.7c-.23 1.5-1.74 4.4-5.7 4.4a6.3 6.3 0 0 1 0-12.6c2 0 3.33.85 4.1 1.58l1.82-1.76A8.7 8.7 0 0 0 12 2.8a9.2 9.2 0 0 0 0 18.4c5.3 0 8.8-3.73 8.8-8.98 0-.6-.06-1.06-.15-1.52H12z",
  },
  discord: {
    viewBox: "0 0 24 24",
    path: "M9.6 9.3a1.1 1.1 0 0 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4.8 0a1.1 1.1 0 0 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM19.1 5.4A15.3 15.3 0 0 0 15.3 4.2l-.3.7a11.5 11.5 0 0 1 2.1.8 10.9 10.9 0 0 0-9.2 0c.65-.33 1.36-.6 2.1-.8l-.3-.7A15.3 15.3 0 0 0 4.9 5.4C2.6 8.9 2 12.3 2.3 15.7a14.5 14.5 0 0 0 4.4 2.2l.9-1.3a9.6 9.6 0 0 1-1.6-.8l.4-.3a11 11 0 0 0 9.2 0l.4.3c-.5.3-1 .57-1.6.8l.9 1.3a14.5 14.5 0 0 0 4.4-2.2c.37-3.9-.6-7.3-2.6-10.3z",
  },
};

export function ProviderMark({ slug }: { slug: string }) {
  const mark = MARKS[slug];
  if (!mark) {
    return null;
  }
  return (
    <svg viewBox={mark.viewBox} fill="currentColor" aria-hidden focusable="false">
      <path d={mark.path} />
    </svg>
  );
}
