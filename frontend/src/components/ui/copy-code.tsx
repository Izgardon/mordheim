import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * A code to share (a campaign's join code, a workshop's share code) in mono capitals, with a copy
 * button that ticks for a moment once the code is on the clipboard.
 */
export function CopyCode({
  code,
  label,
  className,
}: {
  code: string;
  /** What the code is, for the button ("join code", "share code"). */
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <span className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-head">
        {code}
      </span>
      <IconButton
        aria-label={copied ? `${capitalised(label)} copied` : `Copy ${label}`}
        className="h-9 w-9"
        onClick={() => void copy()}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </IconButton>
    </div>
  );
}

const capitalised = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
