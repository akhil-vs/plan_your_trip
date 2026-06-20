"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteLogoLink } from "@/components/ui/SiteLogoLink";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(
        typeof data?.message === "string"
          ? data.message
          : "If an account exists for that email, we sent a reset link."
      );
    } catch {
      setMessage("Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <SiteLogoLink className="justify-center mb-2" />
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We will email you a link that expires in one hour.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required className="min-h-11" />
            </div>
            <Button type="submit" className="w-full min-h-11" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
          {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
