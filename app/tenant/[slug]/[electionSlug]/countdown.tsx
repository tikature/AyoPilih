"use client";

import { useEffect, useState } from "react";

export function Countdown({ startTime, endTime }: { startTime: string; endTime: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    label: string;
    status: "before" | "ongoing" | "after";
  } | null>(null);

  useEffect(() => {
    function update() {
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (now < start) {
        const diff = start.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        setTimeLeft({
          label:
            days > 0
              ? `${days}h ${hours}m sebelum dimulai`
              : `${hours}j ${minutes}m sebelum dimulai`,
          status: "before",
        });
      } else if (now < end) {
        const diff = end.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        setTimeLeft({
          label: `${hours}j ${minutes}m tersisa`,
          status: "ongoing",
        });
      } else {
        setTimeLeft({
          label: "Pemilihan sudah selesai",
          status: "after",
        });
      }
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  if (!timeLeft) return null;

  const color =
    timeLeft.status === "before" ? "text-info" : timeLeft.status === "ongoing" ? "text-success" : "text-muted-foreground";

  return <p className={`text-sm font-semibold ${color}`}>{timeLeft.label}</p>;
}
