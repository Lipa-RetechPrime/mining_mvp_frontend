import type { AuthSession } from "../types";

const AUTH_STORAGE_KEY = "mce-auth-session";

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return Boolean(
    session.token?.startsWith("demo-") &&
      session.user?.email &&
      session.user?.name,
  );
}

export function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: AuthSession | null): void {
  if (typeof window === "undefined") {
    return;
  }

  // Only the local demo session is persisted. Real JWTs stay in memory;
  // NestJS should persist production sessions with a secure HttpOnly cookie.
  if (!session || !session.token.startsWith("demo-")) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session),
  );
}
