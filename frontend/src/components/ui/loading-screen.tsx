import { SwordClashSpinner } from "./sword-clash-spinner";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{
        backgroundImage: "linear-gradient(#000, #000)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-[260px] w-[260px] items-center justify-center">
        <SwordClashSpinner />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
