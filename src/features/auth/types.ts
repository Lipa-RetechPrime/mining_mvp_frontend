export interface AuthUser {
  name: string;
  email: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "error";
