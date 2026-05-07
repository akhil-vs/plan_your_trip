"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Archive,
  BookOpen,
  Compass,
  LogOut,
  Menu,
  Plus,
  Route,
  Shield,
  User,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLogoLink } from "@/components/ui/SiteLogoLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/contexts/AdminAccessContext";

interface AppChromeProps {
  children: React.ReactNode;
}

const APP_ROUTES = ["/dashboard", "/profile", "/admin"];

const sidebarNavItems = [
  { label: "My Trips", href: "/dashboard?view=itineraries", icon: BookOpen },
  { label: "Explore", href: "/dashboard?view=explore", icon: Compass },
  { label: "Shared", href: "/dashboard?view=shared", icon: Users2 },
  { label: "Archive", href: "/dashboard?view=archive", icon: Archive },
  { label: "Generate by destination", href: "/dashboard/generate", icon: Route },
];

export function AppChrome({ children }: AppChromeProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { isAdmin: isAdminUser, ready: adminReady } = useAdminAccess();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldApplyChrome = APP_ROUTES.some((route) => pathname.startsWith(route));

  if (!shouldApplyChrome) return <>{children}</>;

  const linkClass = (href: string) => {
    const targetPath = href.split("?")[0];
    const targetView = href.includes("?view=") ? href.split("?view=")[1] : null;
    const currentView = searchParams.get("view");
    const isActive = targetView
      ? pathname === targetPath && currentView === targetView
      : pathname === targetPath;
    return cn(
      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
      isActive
        ? "bg-indigo-50 font-medium text-indigo-700"
        : "text-slate-700 hover:bg-slate-100"
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-[#f3f4f7] px-4 py-5 lg:flex">
          <div className="pb-6">
            <SiteLogoLink />
          </div>
          <div className="pb-6">
            <p className="text-2xl font-bold tracking-tight text-slate-900">Viazo Elite</p>
            <p className="text-sm text-muted-foreground">Premium Planning</p>
          </div>
          <nav className="space-y-1">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className={linkClass(item.href)}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto">
            <Link href="/planner">
              <Button size="sm" className="h-11 w-full rounded-xl bg-[#031a45] text-white hover:bg-[#05235b]">
                New Trip
              </Button>
            </Link>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-full lg:hidden"
                      aria-label="Open dashboard navigation"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[290px] p-0">
                    <div className="flex h-full flex-col bg-white">
                      <SheetHeader className="border-b px-4 py-4 text-left">
                        <SheetTitle>Dashboard menu</SheetTitle>
                      </SheetHeader>
                      <div className="px-4 py-5">
                        <div className="pb-5">
                          <SiteLogoLink />
                        </div>
                        <div className="pb-6">
                          <p className="text-2xl font-bold tracking-tight text-slate-900">Viazo Elite</p>
                          <p className="text-sm text-muted-foreground">Premium Planning</p>
                        </div>
                        <nav className="space-y-1">
                          {sidebarNavItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <SheetClose asChild key={item.label}>
                                <Link href={item.href} className={linkClass(item.href)}>
                                  <Icon className="h-4 w-4" />
                                  {item.label}
                                </Link>
                              </SheetClose>
                            );
                          })}
                        </nav>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                <SiteLogoLink className="lg:hidden" />
              </div>
              <div className="flex items-center gap-2">
                <Link href="/planner">
                  <Button size="sm" className="h-11 rounded-xl bg-[#031a45] px-5 text-white hover:bg-[#05235b]">
                    <Plus className="mr-1 h-4 w-4" />
                    New itinerary
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full p-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-cyan-100 bg-gradient-to-br from-cyan-500 to-teal-700">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12}>
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{session?.user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/profile")}>
                      <User className="mr-2 h-4 w-4" />
                      Profile & membership
                    </DropdownMenuItem>
                    {adminReady && isAdminUser && (
                      <DropdownMenuItem onClick={() => router.push("/admin")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Admin panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        signOut({
                          callbackUrl:
                            typeof window !== "undefined"
                              ? `${window.location.origin}/`
                              : "/",
                        })
                      }
                      className="text-red-600"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
