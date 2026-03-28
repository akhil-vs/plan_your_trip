"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { ImagePlus, Loader2, Send } from "lucide-react";

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

export function TripMemberChat({ tripId }: TripMemberChatProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLocked, setChatLocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await load();
    } finally {
      setSending(false);
    }
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading chat…
      </div>
    );
  }

  if (chatLocked) {
    return (
      <p className="text-[11px] text-muted-foreground leading-snug">
        Upgrade to Pro to use trip chat and shared photos with collaborators.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-[11px] text-muted-foreground leading-snug">
        Messages and photos are visible to everyone on this itinerary. Images are stored with the trip.
      </p>

      {photoMessages.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Photos</p>
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 px-0.5 scrollbar-thin [scrollbar-width:thin]">
            {photoMessages.map((m) => (
              <button
                key={m.id}
                type="button"
                className="shrink-0 rounded-md border overflow-hidden bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => m.imageUrl && setLightbox(m.imageUrl)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.imageUrl!}
                  alt=""
                  className="h-14 w-14 object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="h-[min(15rem,38dvh)] max-h-[45dvh] rounded-md border bg-muted/20 sm:h-[min(17.5rem,42dvh)]">
        <div className="p-2 space-y-2">
          {messages.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-4">
              No messages yet. Say hi or share a photo from the road.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.user.id === session?.user?.id;
              return (
                <div
                  key={m.id}
                  className={`rounded-lg px-2 py-1.5 text-xs ${
                    mine ? "ml-1 bg-blue-600/10 sm:ml-3" : "mr-1 border bg-background sm:mr-3"
                  }`}
                >
                  <p className="font-medium text-[10px] text-muted-foreground mb-0.5">
                    {m.user.name}
                  </p>
                  {m.body ? (
                    <p className="text-foreground whitespace-pre-wrap break-words">{m.body}</p>
                  ) : null}
                  {m.imageUrl ? (
                    <button
                      type="button"
                      className="mt-1 block rounded-md overflow-hidden border max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setLightbox(m.imageUrl)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="max-h-40 w-auto max-w-full object-contain"
                      />
                    </button>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(m.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1.5">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message the group…"
            className="h-9 min-w-0 flex-1 text-xs"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
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
          <div className="flex shrink-0 justify-end gap-1.5 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 touch-manipulation"
              disabled={sending}
              title="Add photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 touch-manipulation"
              disabled={sending || (!text.trim() && !linkUrl.trim())}
              onClick={async () => {
                const url = linkUrl.trim();
                if (url && !/^https:\/\//i.test(url)) {
                  toast.error("Image links must start with https://");
                  return;
                }
                await send(text, url || undefined);
                setLinkUrl("");
              }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Or paste an https:// image URL"
          className="h-8 min-w-0 text-[11px]"
          disabled={sending}
        />
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[min(90vw,560px)] p-2 sm:p-4" showCloseButton>
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {lightbox ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox} alt="" className="w-full h-auto rounded-md max-h-[80vh] object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
