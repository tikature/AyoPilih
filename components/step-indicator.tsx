"use client";

import { usePathname } from "next/navigation";
import { Info, KeyRound, CheckSquare, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "profil", label: "Profil", icon: Info },
  { key: "masuk", label: "Masuk", icon: KeyRound },
  { key: "coblos", label: "Coblos", icon: CheckSquare },
  { key: "selesai", label: "Selesai", icon: BadgeCheck },
] as const;

type StepKey = typeof STEPS[number]["key"];

function getActiveStep(pathname: string): StepKey {
  if (pathname.endsWith("/masuk")) return "masuk";
  if (pathname.endsWith("/bilik")) return "coblos";
  if (pathname.endsWith("/selesai")) return "selesai";
  return "profil";
}

export function StepIndicator() {
  const pathname = usePathname();
  const activeStep = getActiveStep(pathname);
  const activeIndex = STEPS.findIndex((s) => s.key === activeStep);

  if (
    pathname.includes("/kios") ||
    pathname.includes("/sudah-memilih") ||
    pathname.includes("/hasil") ||
    pathname.includes("/paslon")
  ) {
    return null;
  }

  return (
    <nav
      className="w-full px-4 pt-6 pb-2"
      aria-label="Progres pemilihan"
    >
      <div className="mx-auto max-w-2xl">
        <ol className="flex items-start justify-between" role="list">
          {STEPS.map((step, index) => {
            const isActive = index === activeIndex;
            const isCompleted = index < activeIndex;
            const Icon = step.icon;

            return (
              <li
                key={step.key}
                className="relative flex-1 flex flex-col items-center min-w-0"
                aria-current={isActive ? "step" : undefined}
              >
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "absolute top-4 left-1/2 right-0 -ml-[1px] h-0.5 z-0",
                      isCompleted ? "bg-tenant" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                )}

                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isActive || isCompleted
                      ? "bg-tenant border-tenant text-tenant-foreground"
                      : "bg-background border-border text-muted-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <span
                  className={cn(
                    "mt-1.5 text-[11px] sm:text-xs font-medium text-center leading-tight",
                    isActive || isCompleted
                      ? "text-tenant"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}