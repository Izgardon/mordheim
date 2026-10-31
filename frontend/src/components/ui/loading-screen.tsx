import { SwordClashSpinner } from "./sword-clash-spinner";

type LoadingScreenProps = {
  message?: string;
};

/** A whole screen still loading (design E): the clashing swords on the page colour. */
export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-page"
      role="status"
      aria-live="polite"
    >
      <SwordClashSpinner className="h-auto w-[200px]" />
      <p className="m-0 font-mono text-xs uppercase tracking-[0.16em] text-faint">{message}</p>
    </div>
  );
}
