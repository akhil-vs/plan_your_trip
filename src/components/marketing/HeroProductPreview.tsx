import { MapPin, Mountain, Trees, Clock3 } from "lucide-react";

const stops = [
  { name: "Yellowstone North", meta: "Day 1 · 9:00", icon: Mountain },
  { name: "Rocky Forest Trail", meta: "Day 2 · 11:30", icon: Trees },
  { name: "Lakeside overlook", meta: "Day 3 · 15:00", icon: MapPin },
];

/**
 * Illustrative planner mock (not a live map) aligned with the marketing hero.
 */
export function HeroProductPreview() {
  return (
    <div className="relative mx-auto mt-10 lg:mt-0 max-w-5xl lg:max-w-none px-0 sm:px-1">
      <div
        className="relative rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18)] overflow-hidden ring-1 ring-slate-900/5"
        aria-hidden
      >
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/95 px-3 sm:px-4 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex-1 rounded-md bg-white border border-slate-200/80 px-3 py-1 text-[11px] text-slate-500 truncate text-center font-medium">
            viazo.app/planner
          </div>
        </div>

        <div className="flex flex-col lg:flex-row min-h-[280px] lg:min-h-[360px]">
          <aside className="w-full lg:w-[220px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 bg-white p-3 sm:p-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 px-0.5">
              Stops
            </p>
            {stops.map((s, i) => (
              <div
                key={s.name}
                className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-sm leading-snug">
                    <s.icon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Clock3 className="h-3 w-3 shrink-0" />
                    {s.meta}
                  </p>
                </div>
              </div>
            ))}
          </aside>

          <div className="relative flex-1 min-h-[220px] sm:min-h-[260px] lg:min-h-0 bg-gradient-to-br from-slate-100 via-sky-50/90 to-emerald-50/80">
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(148,163,184,0.14) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)
                `,
                backgroundSize: "26px 26px",
              }}
            />
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 560 320"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <linearGradient id="heroRoute" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              <path
                d="M 72 228 Q 180 52 288 120 T 508 88"
                fill="none"
                stroke="url(#heroRoute)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="14 12"
                opacity="0.95"
              />
              {[
                { cx: 72, cy: 228, fill: "#2563eb" },
                { cx: 288, cy: 120, fill: "#0284c7" },
                { cx: 508, cy: 88, fill: "#0d9488" },
              ].map((p, idx) => (
                <g key={idx} transform={`translate(${p.cx} ${p.cy})`}>
                  <circle r="14" fill="white" opacity="0.96" />
                  <circle r="10" fill={p.fill} />
                  <text
                    y="4"
                    textAnchor="middle"
                    fill="white"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {idx + 1}
                  </text>
                </g>
              ))}
            </svg>

            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-white/90 px-2.5 py-1.5 shadow-md">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-semibold text-slate-800">Trip overview</span>
            </div>

            <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-72 max-w-[min(100%,20rem)] rounded-xl border border-white/80 bg-white/95 backdrop-blur-md p-3.5 shadow-lg space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                At a glance
              </p>
              <p className="text-sm font-bold text-slate-900">1,250 mi · 5 stops</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>7 days duration</span>
                <span>8 people on trip</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
