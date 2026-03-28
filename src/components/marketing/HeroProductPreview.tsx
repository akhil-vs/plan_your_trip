import { MapPin } from "lucide-react";

/**
 * CSS-only product preview (map frame + route) so the hero shows
 * the product without requiring screenshot assets.
 */
export function HeroProductPreview() {
  return (
    <div className="relative mx-auto mt-8 lg:mt-0 max-w-5xl lg:max-w-none px-1">
      <div
        className="relative rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-gray-900/10 overflow-hidden ring-1 ring-black/5"
        aria-hidden
      >
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex-1 rounded-md bg-white border border-gray-200/80 px-3 py-1 text-[11px] text-gray-500 truncate text-center">
            viazo.app/planner
          </div>
        </div>
        <div className="relative aspect-[16/10] sm:aspect-[2/1] bg-gradient-to-br from-slate-100 via-blue-50/80 to-emerald-50/90">
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px),
                linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)
              `,
              backgroundSize: "28px 28px",
            }}
          />
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 800 400"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <path
              d="M 120 280 Q 220 80 400 140 T 680 100"
              fill="none"
              stroke="url(#routeGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="12 10"
              opacity="0.92"
            />
            <circle cx="120" cy="280" r="10" fill="#2563eb" opacity="0.95" />
            <circle cx="400" cy="140" r="10" fill="#0891b2" opacity="0.95" />
            <circle cx="680" cy="100" r="10" fill="#059669" opacity="0.95" />
          </svg>
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-64 max-w-[calc(100%-2rem)] rounded-xl border border-white/70 bg-white/90 backdrop-blur-sm p-3 shadow-lg">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              Live route
            </p>
            <p className="text-xs text-gray-700 mt-0.5 font-medium">
              3 stops · 24 km · ~42 min drive
            </p>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-1 rounded-lg bg-white/90 backdrop-blur-sm border border-white/80 px-2 py-1.5 shadow-md">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-medium text-gray-800">Interactive map</span>
          </div>
        </div>
      </div>
    </div>
  );
}
