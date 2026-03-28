import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 text-brand-primary" aria-hidden>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mx-auto">
          <rect x="8" y="8" width="104" height="104" rx="12" className="stroke-slate-200" strokeWidth="2" fill="none" />
          <path
            d="M30 85 L50 55 L70 70 L90 35"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="6 6"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="60" cy="48" r="6" fill="currentColor" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground font-display">Page not found</h1>
      <p className="mt-2 text-slate-600 max-w-md text-pretty">
        This route does not exist or was moved. Head back to your dashboard or the home page.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
