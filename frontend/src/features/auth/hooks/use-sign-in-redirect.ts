import { useEffect } from "react";

// routing
import { useLocation, useNavigate } from "react-router-dom";

// hooks
import { useAuth } from "./use-auth";

// utils
import { returnPathFrom, sessionEndedNotice } from "../utils/sign-in-redirect";

/**
 * Sends a signed-in visitor on from the sign-in card: back to the page the auth gate redirected
 * from, or to the campaigns list (AUTH-UX-02). Returns the notice to show when the last session
 * ended under the user, else null.
 */
export function useSignInRedirect() {
  const { token, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = returnPathFrom(location.state);

  useEffect(() => {
    if (isReady && token) {
      navigate(returnPath, { replace: true });
    }
  }, [isReady, navigate, returnPath, token]);

  return sessionEndedNotice(location.state);
}
