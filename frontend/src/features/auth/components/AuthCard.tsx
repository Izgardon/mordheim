import "../styles/auth.css";

// components
import { Card, CardContent, CardFooter } from "@components/card";
import { CardBackground } from "@components/card-background";
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
      <Card className="auth-card w-full rounded-b-[32px] border-x border-b border-[#241c16] bg-[#070504]/[0.985] shadow-[0_16px_38px_rgba(0,0,0,0.72)] backdrop-blur">
        {header}
        {content}
        <div className="px-4 pb-4">
          <FootageCredit />
        </div>
      </Card>
    );
  }

  return (
    <CardBackground
      as={Card}
      className="auth-card flex h-full w-full flex-col border border-emerald-500/32 bg-[linear-gradient(180deg,rgba(9,7,6,0.985),rgba(4,3,2,0.995))] shadow-[0_34px_78px_rgba(0,0,0,0.78),0_0_24px_rgba(0,255,153,0.24),0_0_56px_rgba(0,255,153,0.08),inset_0_0_28px_rgba(0,255,153,0.1)] backdrop-blur-sm"
    >
      {header}
      {content}
      <CardFooter className="mt-auto flex-col items-center gap-3">
        <img
          src={titleImage}
          alt="Mordheim: City of the Damned"
          className="w-full max-w-[340px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]"
        />
        <FootageCredit />
      </CardFooter>
    </CardBackground>
  );
}
