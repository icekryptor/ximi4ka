import { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-hero-light flex flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          <span className="font-display text-xl font-bold text-text-primary">
            XimiLearn
          </span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
