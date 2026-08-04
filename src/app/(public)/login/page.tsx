import { LoginForm } from "@/features/auth/components/LoginForm";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="flex h-full overflow-hidden">
      <div className="relative w-1/2">
        <Image
          src="/images/login_bg.jpg"
          alt="Mining site"
          fill
          sizes=""
          className="h-screen w-full object-cover blur-[2px]"
          priority
        />
        <span className="absolute inset-0 block bg-black/50" aria-hidden />
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-white">
          <Image
            src="/icons/LOGO_WHITE.png"
            alt="MCE Portal"
            width={240}
            height={120}
            className="mb-4 h-[120px] w-auto"
          />
          <p className="mt-1 text-xl text-white">
            <b>MCE </b> Portal | Mining Cost Estimation System
          </p>
        </div>
      </div>
      <LoginForm />
    </main>
  );
}
