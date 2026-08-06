"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/shared/components/ui/Button";
import { IconField } from "@/shared/components/ui/IconField";
import { routes } from "@/shared/config/routes";

import { useAuth } from "../hooks/use-auth";

export function LoginForm() {
  const router = useRouter();
  const { login, status, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submitting = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();

    try {
      await login(email, password);
      // Always land on dashboard with the main app menu after login.
      router.replace(routes.dashboard);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="m-auto w-full max-w-md px-8 py-10 ">
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-2xl font-semibold text-[--color-portal-navy]">
          Welcome Back!
        </h1>
        <p className="mt-1 text-sm text-[--text-color]">
          Enter your official credentials to access the secure estimation
          portal.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <IconField
          id="email"
          name="email"
          label="Email"
          icon="mail"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <IconField
          id="password"
          name="password"
          label="Password"
          icon="lock"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Link
          href="/forgot-password"
          className="text-right text-sm text-blue-600"
        >
          Forgot Password?
        </Link>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          variant="primary"
          type="submit"
          disabled={submitting}
          className="mt-2 w-full"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
