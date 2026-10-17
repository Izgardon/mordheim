import { Button } from "./button";

type ConnectionErrorScreenProps = {
  message: string;
  onRetry: () => void;
};

export function ConnectionErrorScreen({ message, onRetry }: ConnectionErrorScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center"
      role="alert"
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
