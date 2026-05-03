import Link from "next/link";
import type { ComponentProps } from "react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

type LogoProps = ComponentProps<typeof Logo>;

export interface SiteLogoLinkProps {
  /** Passed through to the underlying `Logo`. */
  variant?: LogoProps["variant"];
  /** Merged onto the `Link` wrapper (e.g. `justify-center mx-auto`). */
  className?: string;
  onClick?: () => void;
}

/**
 * Home link + wordmark, matching marketing and dashboard breakpoints
 * (`md` from 361px up, `sm` below) so the brand reads the same everywhere.
 */
export function SiteLogoLink({ variant = "default", className, onClick }: SiteLogoLinkProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn(
        "flex items-center min-w-0 shrink-0 touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
        className
      )}
    >
      <span className="hidden min-[361px]:block">
        <Logo size="md" variant={variant} />
      </span>
      <span className="min-[361px]:hidden">
        <Logo size="sm" variant={variant} />
      </span>
    </Link>
  );
}
