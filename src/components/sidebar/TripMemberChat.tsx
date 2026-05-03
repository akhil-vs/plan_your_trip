"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import {
  AtSign,
  Download,
  FolderOpen,
  HelpCircle,
  ImageIcon,
  Link2,
  Loader2,
  Plus,
  Send,
} from "lucide-react";

export interface ChatMessage {
  id: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

interface TripMemberChatProps {
  tripId: string;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fileToCompressedDataUrl(file: File, maxWidth = 1400, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file");
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxWidth) {
        h = (h * maxWidth) / w;
        w = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function isLikelyImageUrl(s: string): boolean {
  const t = s.trim();
  return /^https:\/\//i.test(t) && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(t);
}

export function TripMemberChat({ tripId }: TripMemberChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLocked, setChatLocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkField, setShowLinkField] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosStripRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/chat`);
    if (res.status === 402) {
      setChatLocked(true);
      setMessages([]);
      setLoading(false);
      return;
    }
    setChatLocked(false);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (chatLocked) return;
    const id = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(id);
  }, [load, chatLocked]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (body: string, imageUrl?: string | null) => {
    const trimmed = body.trim();
    if (!trimmed && !imageUrl) return;
    setSending(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed || undefined,
          imageUrl: imageUrl || undefined,
        }),
      });
      const err = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof err?.error === "string" ? err.error : "Could not send message");
        return;
      }
      setText("");
      setLinkUrl("");
      setShowLinkField(false);
      await load();
    } finally {
      setSending(false);
    }
  };

  const submitComposer = async () => {
    const raw = text.trim();
    const url = linkUrl.trim();
    if (url && !/^https:\/\//i.test(url)) {
      toast.error("Image links must start with https://");
      return;
    }
    if (url) {
      await send(raw, url || undefined);
      return;
    }
    if (raw && !url && isLikelyImageUrl(raw)) {
      await send("", raw);
      setText("");
      return;
    }
    await send(raw);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      if (dataUrl.length > 700_000) {
        toast.error("Image is still too large after compression. Try a smaller photo.");
        return;
      }
      await send(text, dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    }
  };

  const photoMessages = messages.filter((m) => m.imageUrl);

  if (loading && messages.length === 0 && !chatLocked) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
        Loading chat…
      </div>
    );
  }

  if (chatLocked) {
    return (
      <p className="text-[13px] leading-relaxed text-slate-500">
        Upgrade to Pro to use trip chat and shared photos with collaborators.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-0.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No messages yet</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-slate-500">
              Say hi or share a photo—everyone on this itinerary can see the thread.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((m) => {
              const displayName = m.user.name?.trim() || "Collaborator";
              return (
                <div key={m.id} className="flex gap-3">
                  <Avatar size="sm" className="mt-0.5 h-8 w-8 ring-1 ring-slate-100">
                    <AvatarFallback className="bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {initialsFromName(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                      <span className="text-sm font-semibold text-slate-900">{displayName}</span>
                      <span className="text-xs text-slate-400">{formatChatTime(m.createdAt)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
                      {m.body ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                          {m.body}
                        </p>
                      ) : null}
                      {m.imageUrl ? (
                        <div className={m.body ? "mt-2" : ""}>
                          <button
                            type="button"
                            className="block w-full max-w-full overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                            onClick={() => setLightbox(m.imageUrl)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.imageUrl}
                              alt=""
                              className="max-h-48 w-full object-cover sm:max-h-56"
                            />
                          </button>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="truncate font-medium text-slate-600">
                              {m.imageUrl.startsWith("data:")
                                ? "Shared photo"
                                : "Image attachment"}
                            </span>
                            <a
                              href={m.imageUrl}
                              download="chat-image"
                              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only sm:not-sr-only sm:inline">Download</span>
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {photoMessages.length > 0 ? (
        <div ref={photosStripRef} className="shrink-0 border-t border-slate-200/80 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Photos
          </p>
          <div className="-mx-0.5 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-thin [scrollbar-width:thin]">
            {photoMessages.map((m) => (
              <button
                key={m.id}
                type="button"
                className="shrink-0 overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
                onClick={() => m.imageUrl && setLightbox(m.imageUrl)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.imageUrl!} alt="" className="h-14 w-14 object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 shrink-0 border-t border-slate-200/80 pt-3">
        <div className="mb-3 flex items-center gap-5 text-xs">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-slate-800"
            onClick={() =>
              toast.message("For account and billing help, use your dashboard settings.")
            }
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            Support
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40"
            disabled={photoMessages.length === 0}
            onClick={() =>
              photosStripRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            Files
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-sm">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message or paste a URL…"
                rows={3}
                disabled={sending}
                className="min-h-[4.5rem] w-full resize-none rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 pr-12 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitComposer();
                  }
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 rounded-full text-slate-500 hover:bg-white hover:text-slate-900"
                disabled={sending}
                title="Add photo"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <Button
              type="button"
              className="h-[4.5rem] w-12 shrink-0 rounded-xl bg-slate-900 text-white shadow-md hover:bg-slate-800 disabled:opacity-40"
              disabled={sending || (!text.trim() && !linkUrl.trim())}
              onClick={() => void submitComposer()}
              title="Send"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>

          {showLinkField ? (
            <div className="mt-2 px-0.5">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://… image URL"
                disabled={sending}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                disabled={sending}
                title="Attach image"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                disabled={sending}
                title="Paste image URL"
                onClick={() => setShowLinkField((v) => !v)}
              >
                <Link2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="Mentions"
                onClick={() => toast.message("Mentions are not available yet.")}
              >
                <AtSign className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <span className="text-[10px] text-slate-400">Markdown supported</span>
          </div>
        </div>
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[min(90vw,560px)] p-2 sm:p-4" showCloseButton>
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {lightbox ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
