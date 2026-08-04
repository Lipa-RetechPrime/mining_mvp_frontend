import { apiRequest } from "@/shared/api/client";
import { env } from "@/shared/config/env";
import { generateUuid } from "@/shared/utils/uuid";

import type {
  AuthSession,
  LoginCredentials,
} from "../types";

const DEMO_EMAIL = "mining.admin@gmail.com";
const DEMO_PASSWORD = "mining@123";

interface LoginResponse {
  accessToken: string;
  user: {
    name: string;
    email: string;
  };
}

function createDemoSession({
  email,
  password,
  displayName,
}: LoginCredentials): AuthSession {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required");
  }

  if (normalizedEmail !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    throw new Error("Invalid email or password");
  }

  return {
    // This is deliberately opaque and local-only. NestJS must issue real JWTs.
    token: `demo-${generateUuid()}`,
    user: {
      email: DEMO_EMAIL,
      name: displayName?.trim() || "Mining Admin",
    },
  };
}

export async function loginWithCredentials(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  if (!env.apiBaseUrl) {
    if (env.nodeEnv !== "production") {
      return createDemoSession(credentials);
    }

    throw new Error("Authentication service is not configured");
  }

  const response = await apiRequest<LoginResponse>("auth/login", {
    method: "POST",
    json: {
      email: credentials.email.trim(),
      password: credentials.password,
    },
  });

  if (!response.accessToken || !response.user?.email) {
    throw new Error("The authentication response is invalid");
  }

  return {
    token: response.accessToken,
    user: response.user,
  };
}
