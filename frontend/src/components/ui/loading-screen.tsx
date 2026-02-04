import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { CardBackground } from "@components/card-background";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <CardBackground className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4">
      <DotLottieReact
        src="https://lottie.host/5ee7e2f2-e1c2-4618-8557-ddd67acc0f4e/WN75g7cNh3.lottie"
        loop
        autoplay
        style={{ width: 260, height: 260 }}
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </CardBackground>
  );
}
