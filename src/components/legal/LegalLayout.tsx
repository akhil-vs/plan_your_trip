import Link from "next/link";
import { SiteLogoLink } from "@/components/ui/SiteLogoLink";

interface LegalLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <SiteLogoLink />
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            Home
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 sm:px-6 prose prose-slate">
        <h1>{title}</h1>
        {children}
        <p className="text-sm text-slate-500 not-prose mt-12">
          Questions?{" "}
          <a href="mailto:hello@viazo.app" className="text-blue-600 hover:underline">
            hello@viazo.app
          </a>
        </p>
      </main>
    </div>
  );
}
