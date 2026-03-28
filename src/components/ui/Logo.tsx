import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: { wrap: "gap-1.5", icon: "h-6 w-6", text: "text-sm" },
  md: { wrap: "gap-2", icon: "h-8 w-8", text: "text-base" },
  lg: { wrap: "gap-2.5", icon: "h-12 w-12", text: "text-xl" },
} as const;

type LogoVariant = "default" | "white" | "dark";

interface LogoProps {
  size?: keyof typeof sizeClasses;
  variant?: LogoVariant;
  className?: string;
}

/** Mark + wordmark “Viazo” as one word. */
export function Logo({ size = "md", variant = "default", className }: LogoProps) {
  const s = sizeClasses[size];

  const strokeFill =
    variant === "white" ? "#ffffff" : variant === "dark" ? "#7dd3fc" : "#2563eb";

  return (
    <span className={cn("inline-flex items-center shrink-0 font-display", s.wrap, className)}>
      <svg
        className={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M24 6c-5.5 0-10 4.3-10 9.6 0 7.2 10 20.4 10 20.4s10-13.2 10-20.4C34 10.3 29.5 6 24 6z"
          stroke={strokeFill}
          strokeWidth="2.5"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M18 22c2.5-2 5.5-2 8 0 2.5 2 6 2 10-1"
          stroke={strokeFill}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="24" cy="17" r="2.5" fill={strokeFill} />
      </svg>
      <span
        className={cn(
          "font-bold leading-none tracking-tight",
          s.text,
          variant === "white" && "text-white",
          variant === "dark" && "text-slate-100",
          variant === "default" &&
            "bg-gradient-to-r from-slate-900 to-brand-primary bg-clip-text text-transparent"
        )}
      >
        Viazo
      </span>
    </span>
  );
}
