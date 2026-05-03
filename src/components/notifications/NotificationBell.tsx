"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Info, Mail, MapPin, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
};

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  TRIP_INVITE_RECEIVED: "Invite",
  TRIP_INVITE_ACCEPTED: "Member joined",
  TRIP_UPDATED: "Trip activity",
  SYSTEM: "System",
};

function notificationTypeLabel(type: string) {
  return NOTIFICATION_TYPE_LABEL[type] ?? type.replace(/_/g, " ").toLowerCase();
}

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "TRIP_INVITE_RECEIVED":
      return <Mail className="size-4 shrink-0 text-blue-600" aria-hidden />;
    case "TRIP_INVITE_ACCEPTED":
      return <UserPlus className="size-4 shrink-0 text-emerald-600" aria-hidden />;
    case "TRIP_UPDATED":
      return <MapPin className="size-4 shrink-0 text-amber-600" aria-hidden />;
    case "SYSTEM":
      return <Info className="size-4 shrink-0 text-slate-600" aria-hidden />;
    default:
      return <Bell className="size-4 shrink-0 text-slate-500" aria-hidden />;
  }
}

function formatRelativeTime(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getHrefFromData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const href = (data as Record<string, unknown>).href;
  return typeof href === "string" && href.startsWith("/") ? href : null;
}

export function NotificationBell({ className }: { className?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/notifications?take=30", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationRow[];
        unreadCount?: number;
      };
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // ignore
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== "authenticated") return;
    intervalRef.current = setInterval(() => void load(), 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ read: true }),
    });
    void load();
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const onSelectNotification = async (n: NotificationRow) => {
    const href = getHrefFromData(n.data);
    if (!n.readAt) {
      await markRead(n.id);
    }
    setOpen(false);
    if (href) {
      router.push(href);
    }
  };

  if (status !== "authenticated") {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("relative shrink-0 rounded-full", className)}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 ? (
            <Badge
              className="absolute -right-0.5 -top-0.5 h-5 min-w-5 px-1 flex items-center justify-center rounded-full border-0 bg-blue-600 text-[10px] font-bold text-white pointer-events-none"
              variant="default"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)] max-h-[min(70vh,24rem)] overflow-y-auto p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-semibold px-1">Notifications</span>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-blue-700 hover:text-blue-800"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void markAllRead();
              }}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="py-1">
            {items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "flex cursor-pointer flex-row items-start gap-2.5 rounded-none px-3 py-2.5 whitespace-normal focus:bg-accent",
                  !n.readAt && "bg-blue-50/60"
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  void onSelectNotification(n);
                }}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80">
                  <NotificationTypeIcon type={n.type} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {notificationTypeLabel(n.type)}
                  </span>
                  <span className="text-sm font-medium text-foreground leading-snug">{n.title}</span>
                  <span className="text-xs text-muted-foreground leading-snug line-clamp-3">{n.body}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          className="text-xs text-muted-foreground focus:text-foreground"
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            router.push("/dashboard");
          }}
        >
          View dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
