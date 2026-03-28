"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      gap={10}
      offset={16}
      mobileOffset={{
        bottom: "max(1rem, calc(0.5rem + env(safe-area-inset-bottom)))",
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-border bg-card text-card-foreground shadow-lg rounded-lg",
          title: "font-medium text-foreground",
          description: "text-muted-foreground text-sm",
          success: "border-semantic-success/40",
          error: "border-destructive/50",
        },
      }}
      className="toaster group"
      {...props}
    />
  );
}
