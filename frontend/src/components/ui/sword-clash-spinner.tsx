import { cn } from "@/lib/utils";

type SwordClashSpinnerProps = {
  className?: string;
};

/**
 * Two swords swinging into a clash: a CSS + SVG stand-in for the old Lottie animation, with no
 * runtime, WASM or third-party requests. Drawn in the design E tokens (steel in the text colours,
 * the guard and the spark in the accent), so it follows the theme. Styles live in index.css
 * (`.sword-clash`).
 */
export function SwordClashSpinner({ className }: SwordClashSpinnerProps) {
  return (
    <svg
      className={cn("sword-clash", className)}
      viewBox="0 0 200 120"
      width={260}
      height={156}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <g id="sword-clash-sword">
          <polygon className="fill-text2" points="-5,-18 5,-18 4,-82 0,-92 -4,-82" />
          <polygon className="fill-faint" points="0,-18 4,-18 3,-82 0,-92" />
          <rect className="fill-primary" x="-15" y="-19" width="30" height="5" />
          <rect className="fill-accent-line" x="-2.5" y="-14" width="5" height="16" />
          <rect className="fill-primary" x="-4" y="1" width="8" height="8" />
        </g>
      </defs>
      <g transform="translate(100 40)">
        <g className="sword-clash__flash">
          <polygon
            className="fill-accent-hi"
            points="0,-16 4,-5 15,-6 7,2 11,13 0,6 -11,13 -7,2 -15,-6 -4,-5"
          />
          <g className="stroke-accent-text" strokeWidth="2.5" strokeLinecap="square">
            <line x1="0" y1="-20" x2="0" y2="-28" />
            <line x1="18" y1="-10" x2="25" y2="-15" />
            <line x1="-18" y1="-10" x2="-25" y2="-15" />
          </g>
        </g>
      </g>
      <g transform="translate(62 112)">
        <g className="sword-clash__sword">
          <use href="#sword-clash-sword" />
        </g>
      </g>
      <g transform="translate(138 112) scale(-1 1)">
        <g className="sword-clash__sword">
          <use href="#sword-clash-sword" />
        </g>
      </g>
    </svg>
  );
}
