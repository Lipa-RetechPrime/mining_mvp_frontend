export type NodeEnvironment = "development" | "test" | "production";

export interface EnvConfig {
  apiBaseUrl?: string;
  appName: string;
  nodeEnv: NodeEnvironment;
}

function parseApiBaseUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();

  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only HTTP(S) URLs are supported.");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL.",
      );
    }

    return undefined;
  }
}

export const env: Readonly<EnvConfig> = Object.freeze({
  apiBaseUrl: parseApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
  appName:
    process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Mining Cost Estimation",
  nodeEnv: process.env.NODE_ENV,
});
