"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type NavContext = "home" | "pricing";

interface MarketingNavProps {
  context: NavContext;
}

const navLinkClass =
  "relative py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-brand-primary after:transition-all after:duration-200 hover:after:w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 rounded-sm";

export function MarketingNav({ context }: MarketingNavProps) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const close = () => setOpen(false);
  const isAuthed = status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b transition-[background,box-shadow,backdrop-filter] duration-200",
        scrolled
          ? "bg-white/90 backdrop-blur-sm border-slate-200 shadow-sm"
          : "bg-white/85 backdrop-blur-md border-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center min-w-0 touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          onClick={close}
        >
          <span className="hidden min-[361px]:block">
            <Logo size="md" variant="default" />
          </span>
          <span className="min-[361px]:hidden">
            <Logo size="sm" variant="default" />
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 lg:gap-3">
          {context === "pricing" && (
            <Link href="/" className={cn(navLinkClass, "px-2")}>
              Home
            </Link>
          )}
          <Link href="/pricing" className={cn(navLinkClass, "px-2")}>
            Pricing
          </Link>
          {status === "loading" ? (
            <div
              className="ml-1 h-9 w-[11rem] rounded-md bg-slate-200/60 animate-pulse"
              aria-hidden
            />
          ) : isAuthed ? (
            <>
              <Link href="/dashboard" className={cn(navLinkClass, "px-2")}>
                Dashboard
              </Link>
              <Link href="/planner" className="ml-1">
                <Button size="sm" className="shadow-sm hover:shadow-md transition-shadow">
                  Open planner
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className={cn(navLinkClass, "px-2")}>
                Sign in
              </Link>
              <Link href="/auth/register" className="ml-1">
                <Button size="sm" className="shadow-sm hover:shadow-md transition-shadow">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw,20rem)]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6 px-1" aria-label="Mobile">
                <Link href="/" onClick={close}>
                  <Button variant="ghost" className="w-full justify-start h-11 text-base">
                    Home
                  </Button>
                </Link>
                <Link href="/pricing" onClick={close}>
                  <Button variant="ghost" className="w-full justify-start h-11 text-base">
                    Pricing
                  </Button>
                </Link>
                {status === "loading" ? (
                  <div className="h-11 rounded-md bg-slate-200/60 animate-pulse" aria-hidden />
                ) : isAuthed ? (
                  <>
                    <Link href="/dashboard" onClick={close}>
                      <Button variant="ghost" className="w-full justify-start h-11 text-base">
                        Dashboard
                      </Button>
                    </Link>
                    <Link href="/planner" onClick={close}>
                      <Button className="w-full h-11 text-base">Open planner</Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={close}>
                      <Button variant="ghost" className="w-full justify-start h-11 text-base">
                        Sign in
                      </Button>
                    </Link>
                    <Link href="/auth/register" onClick={close}>
                      <Button className="w-full h-11 text-base">Get started</Button>
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
