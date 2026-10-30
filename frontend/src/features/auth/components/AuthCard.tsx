import "../styles/auth.css";

// components
import { Card, CardContent, CardFooter } from "@components/card";
import { AuthCardHeader } from "./auth-card/AuthCardHeader";
import { FootageCredit } from "./auth-card/FootageCredit";
import { ForgotForm } from "./auth-card/ForgotForm";
import { LoginForm } from "./auth-card/LoginForm";
import { RegisterForm } from "./auth-card/RegisterForm";

// hooks
import { useAuthCard } from "../hooks/use-auth-card";
import { useSignInRedirect } from "../hooks/use-sign-in-redirect";
import { useMediaQuery } from "@/lib/use-media-query";
import titleImage from "@/assets/background/title.webp";

/** Sign in, create an account, or ask for a reset link; a phone gets the compact layout. */
export default function AuthCard() {
  const sessionNotice = useSignInRedirect();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const card = useAuthCard();

  const header = (
    <AuthCardHeader mode={card.mode} isMobile={isMobile} onSelectMode={card.setMode} />
  );

  const content = (
    <CardContent className={isMobile ? "px-4 pb-4 pt-2" : "flex-1"}>
      {sessionNotice ? (
        <p role="status" className="mx-auto mb-5 max-w-[320px] text-sm">
          {sessionNotice}
        </p>
      ) : null}
      {card.mode === "forgot" ? (
        <ForgotForm
          form={card.forgot}
          error={card.error}
          notice={card.notice}
          onBack={() => card.setMode("login")}
        />
      ) : card.mode === "register" ? (
        <RegisterForm form={card.register} error={card.error} />
      ) : (
        <LoginForm form={card.login} error={card.error} onForgot={() => card.setMode("forgot")} />
      )}
    </CardContent>
  );

  if (isMobile) {
    return (
      <Card className="auth-card w-full border-x border-b border-border bg-panel">
        {header}
        {content}
        <div className="px-4 pb-4">
          <FootageCredit />
        </div>
      </Card>
    );
  }

  return (
    <Card className="auth-card flex h-full w-full flex-col border border-border bg-panel">
      {header}
      {content}
      <CardFooter className="mt-auto flex-col items-center gap-3">
        <img src={titleImage} alt="Mordheim: City of the Damned" className="w-full max-w-[340px]" />
        <FootageCredit />
      </CardFooter>
    </Card>
  );
}
