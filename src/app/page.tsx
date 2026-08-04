import { env } from "@/shared/config/env";

const stack = [
  {
    name: "Next.js",
    detail: "App Router",
  },
  {
    name: "TypeScript",
    detail: "Strict mode",
  },
  {
    name: "Redux Toolkit",
    detail: "Shared client state",
  },
  {
    name: "Tailwind CSS",
    detail: "Version 3.4.17",
  },
] as const;

export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-zinc-950 px-6 py-16 text-zinc-50 sm:px-10 lg:px-16">
      <section className="mx-auto w-full max-w-6xl">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-300">
            Frontend foundation ready
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {env.appName}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            A frontend-only foundation for the mining cost estimation portal.
            Product workflows will connect to the separately managed NestJS API
            as they are implemented.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stack.map((technology) => (
            <article
              key={technology.name}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="font-semibold text-white">{technology.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{technology.detail}</p>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          Authentication, RBAC, tenant, project, and estimation workflows are
          intentionally outside this foundation.
        </p>
      </section>
    </main>
  );
}
