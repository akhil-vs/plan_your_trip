"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/Logo";
import { FadeIn } from "@/components/ui/FadeIn";
import {
  OnboardingDestinationInput,
  type DestinationSelection,
} from "@/components/onboarding/OnboardingDestinationInput";
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PREFS = [
  { id: "solo", label: "Solo", hint: "Just me" },
  { id: "couple", label: "Couple", hint: "Two travelers" },
  { id: "family", label: "Family", hint: "Kids & adults" },
  { id: "group", label: "Group", hint: "Friends or tour" },
] as const;

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState<DestinationSelection | null>(null);
  const [preference, setPreference] = useState<(typeof PREFS)[number]["id"] | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/auth/login");
      return;
    }
    fetch("/api/account/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me?.onboardingComplete) {
          router.replace("/dashboard");
        }
      })
      .finally(() => setChecking(false));
  }, [session, status, router]);

  async function handleFinish() {
    if (!destination || !preference) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationName: destination.name,
          lat: destination.lat,
          lng: destination.lng,
          travelPreference: preference,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!session?.user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-brand-primary/5 via-background to-brand-accent/10">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <span className="text-xs text-muted-foreground tabular-nums">
            Step {step + 1} of 3
          </span>
        </div>
      </header>

      <main id="main" className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <FadeIn className="w-full max-w-lg">
          <Card className="border-border/80 shadow-lg">
            <CardHeader className="space-y-1">
              <div className="flex gap-1.5 mb-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= step ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              {step === 0 && (
                <>
                  <CardTitle className="text-xl sm:text-2xl">Where are you going?</CardTitle>
                  <CardDescription>
                    Search for a city or place. We&apos;ll sketch a starter itinerary you can
                    refine later.
                  </CardDescription>
                </>
              )}
              {step === 1 && (
                <>
                  <CardTitle className="text-xl sm:text-2xl">Who&apos;s traveling?</CardTitle>
                  <CardDescription>
                    This helps us tune suggestions. You can change it anytime.
                  </CardDescription>
                </>
              )}
              {step === 2 && (
                <>
                  <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                    You&apos;re set
                  </CardTitle>
                  <CardDescription>
                    We&apos;ll create a trip with your destination plus a couple of nearby stops.
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              {step === 0 && (
                <OnboardingDestinationInput
                  value={destination}
                  onChange={setDestination}
                  disabled={submitting}
                />
              )}

              {step === 1 && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {PREFS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreference(p.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-all",
                        "hover:border-primary/50 hover:bg-muted/40",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        preference === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card"
                      )}
                    >
                      <p className="font-medium text-sm">{p.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.hint}</p>
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && destination && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Destination</span>
                    <br />
                    <span className="font-medium">{destination.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Travel style</span>
                    <br />
                    <span className="font-medium capitalize">
                      {PREFS.find((p) => p.id === preference)?.label ?? preference}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:mr-auto"
                  onClick={() => {
                    setError("");
                    if (step === 0) {
                      setSubmitting(true);
                      fetch("/api/onboarding/skip", { method: "POST" })
                        .then((res) => {
                          if (!res.ok) throw new Error("skip failed");
                          router.push("/dashboard");
                          router.refresh();
                        })
                        .catch(() => setError("Could not skip. Try again."))
                        .finally(() => setSubmitting(false));
                    } else {
                      setStep((s) => s - 1);
                    }
                  }}
                  disabled={submitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {step === 0 ? "Skip for now" : "Back"}
                </Button>
                <div className="flex gap-2 sm:ml-auto">
                  {step < 2 ? (
                    <Button
                      type="button"
                      className="min-w-[120px]"
                      disabled={
                        submitting ||
                        (step === 0 && !destination) ||
                        (step === 1 && !preference)
                      }
                      onClick={() => {
                        setError("");
                        setStep((s) => s + 1);
                      }}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="min-w-[160px]"
                      disabled={submitting || !destination || !preference}
                      isLoading={submitting}
                      onClick={() => void handleFinish()}
                    >
                      Start planning
                    </Button>
                  )}
                </div>
              </div>

              {step === 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Skipping still marks onboarding complete and sends you to the dashboard without
                  creating a trip.
                </p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </main>
    </div>
  );
}
