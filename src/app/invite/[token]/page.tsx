"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserPlus } from "lucide-react";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/trips/invites/${token}/accept`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "Failed to accept invite");
      setLoading(false);
      return;
    }
    setMessage("Invite accepted. Redirecting to itinerary...");
    router.push(`/planner/${data.tripId}`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Trip Invite</CardTitle>
            <CardDescription>Sign in to accept this collaboration invite.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() =>
                router.push(
                  `/auth/login?callbackUrl=${encodeURIComponent(pathname || "/dashboard")}`
                )
              }
            >
              Continue to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Trip Collaboration</CardTitle>
          <CardDescription>
            Accept this invite to start planning locations, stays, and restaurants with your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleAccept} disabled={loading || !token} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Accept invite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
