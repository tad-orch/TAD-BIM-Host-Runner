import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-primary/12 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground",
  success: "bg-emerald-500/12 text-emerald-700",
  warning: "bg-amber-500/14 text-amber-700",
  destructive: "bg-destructive/12 text-destructive",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
