import { Minus, Plus, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** The veterans' pool left after these recruits, and the XP each takes (a new group's, to set). */
export function VeteranXp({
  left,
  total,
  each,
  fixed,
  onEach,
}: {
  left: number;
  total: number;
  each: number;
  /** An existing group's recruits join at its XP. */
  fixed: boolean;
  onEach: (each: number) => void;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between border-t border-line pt-2.5">
        <span className="text-xs font-bold text-muted-foreground">Veteran experience to share</span>
        <span className="font-mono text-sm text-text2">
          <span className={cn("font-bold", left < 0 ? "text-danger" : "text-head")}>{left}</span> of{" "}
          {total} left
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-sm font-semibold text-ink">
          {fixed ? "Each joins at the group's XP" : "XP each"}
        </span>
        {fixed ? null : (
          <IconButton
            aria-label="Less experience each"
            className="h-9 w-9"
            disabled={each <= 0}
            onClick={() => onEach(each - 1)}
          >
            <Minus aria-hidden="true" />
          </IconButton>
        )}
        <span className="min-w-[54px] text-center font-mono text-sm font-bold text-head">
          {each} XP
        </span>
        {fixed ? null : (
          <IconButton
            aria-label="More experience each"
            className="h-9 w-9"
            onClick={() => onEach(each + 1)}
          >
            <Plus aria-hidden="true" />
          </IconButton>
        )}
      </div>
    </>
  );
}

/** Each recruit's name (a placeholder when left blank), with Remove. */
export function RecruitNames({
  recruits,
  placeholder,
  onChange,
}: {
  recruits: string[];
  placeholder: (index: number) => string;
  onChange: (recruits: string[]) => void;
}) {
  return recruits.map((recruitName, index) => (
    <div key={index} className="flex items-center gap-2">
      <Input
        inputSize="sm"
        aria-label={`Recruit ${index + 1} name`}
        placeholder={placeholder(index)}
        value={recruitName}
        onChange={(e) => onChange(recruits.map((n, i) => (i === index ? e.target.value : n)))}
      />
      <IconButton
        aria-label={`Remove recruit ${index + 1}`}
        className="h-9 w-9"
        onClick={() => onChange(recruits.filter((_, i) => i !== index))}
      >
        <X aria-hidden="true" />
      </IconButton>
    </div>
  ));
}
