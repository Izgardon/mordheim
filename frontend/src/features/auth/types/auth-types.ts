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
