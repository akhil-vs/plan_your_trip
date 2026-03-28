"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-foreground font-display">Something went wrong</h1>
      <p className="mt-2 text-slate-600 max-w-md text-pretty">
        We could not load this page. You can try again or return home.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
