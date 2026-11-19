export type AuthUser = {
  id: number;
  email: string;
  name?: string;
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type AuthResponse = AuthTokens & {
  user: AuthUser;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name?: string;
};

export type PasswordResetRequestPayload = {
  email: string;
};

export type PasswordResetConfirmPayload = {
  uid: string;
  token: string;
  new_password: string;
};

export type PasswordChangePayload = {
  current_password: string;
  new_password: string;
};

/**
 * What deleting the account does to one campaign: hand it to an admin first (an owned campaign
 * with other members), archive it (owned, alone in it), or leave it.
 */
export type DeletionOutcome = "hand_over_first" | "archived" | "left";

export type DeletionCampaign = {
  id: number;
  name: string;
  role: string;
  archived: boolean;
  outcome: DeletionOutcome;
  /** Kept in the campaign as a retired record. */
  warband: { id: number; name: string } | null;
};

/** `GET auth/me/deletion/`: each campaign's outcome and the open battles and trades that close. */
export type AccountDeletionPreview = {
  campaigns: DeletionCampaign[];
  battles: number;
  trades: number;
  can_delete: boolean;
};

export type FeedbackReportPayload = {
  report_type: "Bug" | "Feedback";
  message: string;
  campaign_id?: number;
  campaign_name?: string;
  warband_id?: number;
  warband_name?: string;
};

/** One social sign-in provider this deploy has set up (`GET auth/sso/providers/`). */
export type SsoProvider = {
  slug: string;
  label: string;
};

/**
 * `GET auth/sso/<provider>/start/`: where to send the browser, and the two values the callback
 * must send back. The client id and PKCE verifier stay on the server; `browser_token` is the
 * secret that ties the attempt to this browser.
 */
export type SsoStart = {
  authorize_url: string;
  state: string;
  browser_token: string;
};

/** `POST auth/sso/<provider>/callback/`: the provider's code and state, with the browser's secret. */
export type SsoCallbackPayload = {
  code: string;
  state: string;
  browser_token: string;
};
