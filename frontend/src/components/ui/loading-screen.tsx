import { DotLottieReact } from "@lottiefiles/dotlottie-react";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <DotLottieReact
        src="https://lottie.host/5ee7e2f2-e1c2-4618-8557-ddd67acc0f4e/WN75g7cNh3.lottie"
        loop
        autoplay
        style={{ width: 300, height: 300 }}
      />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
