import { routes } from "@/shared/config/routes";

const RETURN_TO_QUERY = "next";

/** Same-origin relative paths only — blocks open redirects. */
export function getSafeReturnPath(
  value: string | null | undefined,
  fallback: string = routes.dashboard,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value === routes.login || value.startsWith(`${routes.login}?`)) {
    return fallback;
  }

  return value;
}

export function buildLoginHref(returnTo?: string | null): string {
  const safe = returnTo
    ? getSafeReturnPath(returnTo, "")
    : "";

  if (!safe) {
    return routes.login;
  }

  const params = new URLSearchParams({
    [RETURN_TO_QUERY]: safe,
  });

  return `${routes.login}?${params.toString()}`;
}

export function readReturnPath(
  searchParams: URLSearchParams | { get(name: string): string | null },
  fallback: string = routes.dashboard,
): string {
  return getSafeReturnPath(
    searchParams.get(RETURN_TO_QUERY),
    fallback,
  );
}
