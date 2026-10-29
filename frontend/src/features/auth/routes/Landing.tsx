import AuthCard from "../components/AuthCard";
import AuthShell from "../components/AuthShell";
import { LandingVideo } from "../components/LandingVideo";

/** Sign in or create an account; on desktop, beside the background video (decision 5). */
export default function Landing() {
  return (
    <AuthShell aside={<LandingVideo />}>
      <AuthCard />
    </AuthShell>
  );
}
