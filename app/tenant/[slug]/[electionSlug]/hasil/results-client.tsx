"use client";

import { useEffect, useState } from "react";
import type { LiveCountRow, Turnout } from "@/types";

interface ResultsClientProps {
  electionId: string;
  electionTitle: string;
  electionStatus: "DRAFT" | "SCHEDULED" | "ONGOING" | "CLOSED" | "ARCHIVED";
  initialData: {
    liveCount: LiveCountRow[];
    turnout: Turnout;
  };
}

export function ResultsClient({
  electionId,
  electionTitle,
  electionStatus,
  initialData,
}: ResultsClientProps) {
  const [liveCount, setLiveCount] = useState<LiveCountRow[]>(initialData.liveCount);
  const [turnout, setTurnout] = useState<Turnout>(initialData.turnout);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/results/" + electionId);
        if (res.ok) {
          const data = await res.json();
          if (data.liveCount) setLiveCount(data.liveCount);
          if (data.turnout) setTurnout(data.turnout);
          setLastUpdated(new Date());
        }
      } catch {
        // Silently fail
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [electionId]);

  const totalVotes = liveCount.reduce((sum, row) => sum + (row.total ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="font-display text-3xl font-bold">{electionTitle}</h1>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {electionStatus === "ONGOING" && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-sm font-medium text-warning">
              <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              Data sementara, dapat berubah
            </div>
          )}
          {electionStatus === "CLOSED" && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-success">Pemilihan Selesai</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            Terakhir diperbarui: {lastUpdated.toLocaleTimeString("id-ID")}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-bold">Perolehan Suara per Paslon</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Total suara masuk: <span className="font-mono font-bold">{totalVotes}</span>
            </p>

            <div className="mt-6 h-[350px] w-full">
              <div className="text-center text-muted-foreground">
                Chart placeholder - Recharts not loaded
              </div>
            </div>
          </div>

        <div className="flex flex-col items-center">
          <div className="rounded-3xl border border-border bg-card p-6 w-full max-w-xs mx-auto">
            <h2 className="font-display text-xl font-bold text-center">Partisipasi</h2>
            <div className="relative w-[180px] h-[180px] mx-auto mt-4">
              <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Partisipasi">
                <circle cx="90" cy="90" r="84" fill="none" stroke="hsl(var(--border))" strokeWidth="12" />
                <circle cx="90" cy="90" r="84" fill="none" stroke="hsl(var(--tenant))" strokeWidth="12" strokeLinecap="round" strokeDasharray="527.7875658030853" strokeDashoffset="527.7875658030853" transform="rotate(-90 90 90)" style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
                <text x="90" y="90" dominantBaseline="middle" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="32.4" fontWeight="700" fill="hsl(var(--foreground))">{turnout.percentage.toFixed(1)}%</text>
              </svg>
            </div>
            <div className="mt-6 space-y-2 text-center">
              <p className="text-sm text-muted-foreground">Total DPT</p>
              <p className="font-mono text-3xl font-bold">{turnout.total_voters.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground pt-2 border-t border-border">Sudah Memilih</p>
              <p className="font-mono text-2xl font-bold text-primary">{turnout.voted.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground pt-2 border-t border-border">Belum Memilih</p>
              <p className="font-mono text-xl font-bold text-muted-foreground">
                {turnout.total_voters - turnout.voted}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Detail Perolehan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-4 text-left text-sm font-semibold text-muted-foreground">No. Urut</th>
                <th className="p-4 text-left text-sm font-semibold text-muted-foreground">Nama Paslon</th>
                <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Jumlah Suara</th>
                <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Persentase</th>
              </tr>
            </thead>
            <tbody>
              {liveCount.map((row) => (
                <tr key={row.candidate_id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4 font-mono font-bold text-lg text-tenant">{row.candidate_number}</td>
                  <td className="p-4 font-semibold">{row.name}</td>
                  <td className="p-4 text-right font-mono tabular-nums">{row.total?.toLocaleString() ?? "0"}</td>
                  <td className="p-4 text-right font-medium tabular-nums">
                    {totalVotes > 0 ? ((row.total ?? 0) / totalVotes * 100).toFixed(2) + "%" : "0.00%"}
                  </td>
                </tr>
              ))}
              {liveCount.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Belum ada suara masuk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  );
}