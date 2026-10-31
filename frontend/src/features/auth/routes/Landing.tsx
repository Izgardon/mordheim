import AuthCard from "../components/AuthCard";
import AuthShell from "../components/AuthShell";
import { FootageCredit } from "../components/auth-card/FootageCredit";
import { LandingVideo } from "../components/LandingVideo";

/** Sign in or create an account; on the web, beside the background video (decision 5). */
export default function Landing() {
  return (
    <AuthShell video={<LandingVideo />} credit={<FootageCredit />}>
      <AuthCard />
    </AuthShell>
  );
}
