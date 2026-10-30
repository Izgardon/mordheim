import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** The small uppercase caption above a field or a group (design E). */
export const CAPTION = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

type SettingsCardProps = {
  title: string;
  /** One line under the title: what the card changes. */
  description?: ReactNode;
  /** Beside the title: the card's own Edit or Add button. */
  action?: ReactNode;
  /** A lossy card (delete, leave) reads in danger colours. */
  tone?: "danger";
  className?: string;
  children?: ReactNode;
};

/** One card of a settings section: its title, a line saying what it does, then its fields. */
export function SettingsCard({
  title,
  description,
  action,
  tone,
  className,
  children,
}: SettingsCardProps) {
  return (
    <Card
      as="section"
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 p-5 max-[960px]:p-4",
        tone === "danger" && "border-danger-line",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2
            className={cn(
              "m-0 font-display text-xl font-semibold leading-tight",
              tone === "danger" ? "text-danger" : "text-head"
            )}
          >
            {title}
          </h2>
          {description ? <p className="m-0 text-sm text-text2">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </Card>
  );
}

type SettingRowProps = {
  label: string;
  hint?: ReactNode;
  /** The control: a switch, a field and its Save. */
  children?: ReactNode;
  /** Under the row at full width: a list it edits, a picker. */
  below?: ReactNode;
  /** The row's error, under it. */
  error?: string;
};

/** A labelled setting: the label and its hint on the left, the control on the right (stacked on a phone). */
export function SettingRow({ label, hint, children, below, error }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold text-head">{label}</span>
          {hint ? <span className="text-[13px] text-text2">{hint}</span> : null}
        </div>
        {children ? (
          <div className="flex flex-wrap items-center gap-2 max-[960px]:w-full">{children}</div>
        ) : null}
      </div>
      {below}
      <FormError message={error} />
    </div>
  );
}

/** A refusal or a check that failed, in danger colours (nothing when there is none). */
export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="m-0 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/** A labelled field in a form: its caption, then the control. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className={CAPTION}>
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** A small tag beside a name: a role, Stuck, an area. */
export function Tag({ children, tone }: { children: ReactNode; tone?: "accent" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-[7px] py-px text-[11px] font-bold",
        tone === "accent"
          ? "border-accent-line text-accent-text"
          : tone === "danger"
            ? "border-danger-line text-danger"
            : "border-border text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

/** The textarea style the settings forms share (square, on the tokens). */
export const TEXTAREA =
  "min-h-[110px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50";
