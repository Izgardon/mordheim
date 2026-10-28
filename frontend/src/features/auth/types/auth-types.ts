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

export type FeedbackReportPayload = {
  report_type: "Bug" | "Feedback";
  message: string;
  campaign_id?: number;
  campaign_name?: string;
  warband_id?: number;
  warband_name?: string;
};
