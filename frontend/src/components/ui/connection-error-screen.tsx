import { ErrorState } from "./error-state";

type ConnectionErrorScreenProps = {
  message: string;
  onRetry: () => void;
};

/** The server couldn't be reached while signing you in (design E): what happened, and Retry. */
export function ConnectionErrorScreen({ message, onRetry }: ConnectionErrorScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-page px-4">
      <ErrorState
        look="card"
        title="Can't reach the chronicle"
        message={message}
        onRetry={onRetry}
      />
    </div>
  );
}
