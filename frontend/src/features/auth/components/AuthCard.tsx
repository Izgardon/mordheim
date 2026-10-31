// components
import { AuthHeading } from "./AuthShell";
import { AuthModeSwitch } from "./auth-card/AuthModeSwitch";
import { ForgotForm } from "./auth-card/ForgotForm";
import { LoginForm } from "./auth-card/LoginForm";
import { RegisterForm } from "./auth-card/RegisterForm";

// hooks
import { useAuthCard } from "../hooks/use-auth-card";
import { useSignInRedirect } from "../hooks/use-sign-in-redirect";

/** Sign in, create an account, or ask for a reset link (design E), in the auth column. */
export default function AuthCard() {
  const sessionNotice = useSignInRedirect();
  const card = useAuthCard();

  return (
    <>
      <AuthHeading kicker="City of the Damned" title="Mordheim Chronicler">
        <p className="m-0 text-[15px] leading-relaxed text-text2">
          The record of your Mordheim campaign: every warband, battle and Aftermath, kept in one
          place for the whole table.
        </p>
      </AuthHeading>
      {sessionNotice ? (
        <p
          role="status"
          className="m-0 border border-accent-line bg-accent-soft px-3.5 py-3 text-sm text-ink"
        >
          {sessionNotice}
        </p>
      ) : null}
      <div className="flex flex-col gap-6">
        <AuthModeSwitch mode={card.mode} onSelect={card.setMode} />
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
      </div>
    </>
  );
}
