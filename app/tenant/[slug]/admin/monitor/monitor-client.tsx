"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Users,
  CheckCircle2,
  Hourglass,
  Percent,
  Crown,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { LiveCountRow, Turnout, VelocityBucket, CandidatePhoto } from "@/types";

interface MonitorClientProps {
  electionId: string;
  electionStatus: string;
  initialData: {
    liveCount: LiveCountRow[];
    turnout: Turnout;
    velocity: VelocityBucket[];
    candidatePhotos: CandidatePhoto[];
  };
}

interface LiveCountRowWithPhoto extends LiveCountRow {
  photo_url: string | null;
}

interface VelocityPoint {
  label: string;
  total: number;
}

export function MonitorClient({
  electionId,
  electionStatus,
  initialData,
}: MonitorClientProps) {
  const [liveCount, setLiveCount] = useState<LiveCountRowWithPhoto[]>(
    mergePhotos(initialData.liveCount, initialData.candidatePhotos),
  );
  const [turnout, setTurnout] = useState<Turnout>(initialData.turnout);
  const [velocity, setVelocity] = useState<VelocityBucket[]>(initialData.velocity);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInitial = useCallback(async () => {
    const supabase = createClient();
    try {
      const [
        { data: liveCountData },
        { data: turnoutData },
        { data: velocityData },
        { data: candidatesData },
      ] = await Promise.all([
        supabase.rpc("get_live_count", { p_election_id: electionId }),
        supabase.rpc("get_turnout", { p_election_id: electionId }),
        supabase.rpc("get_vote_velocity", {
          p_election_id: electionId,
          p_bucket_minutes: 5,
          p_window_minutes: 120,
        }),
        supabase
          .from("candidates")
          .select("id, candidate_number, photo_url")
          .eq("election_id", electionId),
      ]);

      if (liveCountData) {
        setLiveCount(
          mergePhotos(
            liveCountData as unknown as LiveCountRow[],
            (candidatesData ?? []) as CandidatePhoto[],
          ),
        );
      }
      const turnoutRow = (turnoutData ?? [])[0] as
        | { total_voters: number; voted: number }
        | undefined;
      if (turnoutRow) {
        setTurnout({
          total_voters: turnoutRow.total_voters ?? 0,
          voted: turnoutRow.voted ?? 0,
          percentage:
            turnoutRow && turnoutRow.total_voters > 0
              ? Math.round((turnoutRow.voted / turnoutRow.total_voters) * 10000) / 100
              : 0,
        });
      }
      if (velocityData) {
        setVelocity(velocityData as VelocityBucket[]);
      }
    } catch {
      // Silently fail; connection status will handle retry.
    }
  }, [electionId]);

  // Realtime subscription with polling fallback (5s).
  useEffect(() => {
    const supabase = createClient();

    const startFallbackPolling = () => {
      if (fallbackIntervalRef.current) return;
      fetchInitial();
      fallbackIntervalRef.current = setInterval(() => {
        fetchInitial();
      }, 5000);
    };

    const stopFallbackPolling = () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    const votesChannel = supabase
      .channel("monitor-votes-" + electionId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "votes",
          filter: "election_id=eq." + electionId,
        },
        () => {
          fetchInitial();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "voters",
          filter: "election_id=eq." + electionId,
        },
        () => {
          fetchInitial();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          stopFallbackPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsConnected(false);
          startFallbackPolling();
        }
      });

    return () => {
      supabase.removeChannel(votesChannel);
      setIsConnected(false);
      stopFallbackPolling();
    };
  }, [electionId, fetchInitial]);

  const totalVotes = useMemo(
    () => liveCount.reduce((sum, row) => sum + (row.total ?? 0), 0),
    [liveCount],
  );

  const ranking = useMemo(() => {
    const sorted = [...liveCount].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const leader = sorted[0];
    const runnerUp = sorted[1];
    return {
      sorted,
      leader,
      runnerUp,
      gap:
        leader && runnerUp ? (leader.total ?? 0) - (runnerUp.total ?? 0) : 0,
      showGap: sorted.length >= 2,
    };
  }, [liveCount]);

  const velocityPoints = useMemo<VelocityPoint[]>(() => {
    if (velocity.length === 0) return [];
    return velocity.map((bucket) => ({
      label: formatBucketLabel(bucket.bucket_start),
      total: bucket.total,
    }));
  }, [velocity]);

  const hasAnyVote = totalVotes > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-3 w-3 rounded-full",
              isConnected ? "bg-success" : "bg-destructive",
              "animate-pulse"
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">
            {isConnected ? "Terhubung (Realtime)" : "Menggunakan Polling Fallback"}
          </span>
          {electionStatus === "ONGOING" && (
            <span className="inline-flex h-6 items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
              LIVE
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Data sementara, dapat berubah
        </p>
      </div>

      <KpiStrip turnout={turnout} totalVotes={totalVotes} />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <CandidateResultsChart rows={liveCount} totalVotes={totalVotes} />
          <VelocityChart points={velocityPoints} hasAnyVote={hasAnyVote} />
        </div>

        <div className="space-y-6">
          <RankingHighlight
            leader={ranking.leader}
            runnerUp={ranking.runnerUp}
            gap={ranking.gap}
            showGap={ranking.showGap}
            totalVotes={totalVotes}
            turnout={turnout}
          />
        </div>
      </div>

      <DetailTable rows={ranking.sorted} totalVotes={totalVotes} />
    </div>
  );
}

function mergePhotos(
  rows: LiveCountRow[],
  photos: CandidatePhoto[]
): LiveCountRowWithPhoto[] {
  if (rows.length === 0) return [];
  const photoMap = new Map(photos.map((p) => [p.id, p.photo_url]));
  return rows.map((row) => ({
    ...row,
    photo_url: photoMap.get(row.candidate_id) ?? null,
  }));
}

function formatBucketLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// =====================================================================
// KPI strip — 4 angka besar: Total DPT · Sudah Memilih · Belum Memilih · Partisipasi %
// =====================================================================

function KpiStrip({ turnout, totalVotes }: { turnout: Turnout; totalVotes: number }) {
  const remaining = Math.max(turnout.total_voters - turnout.voted, 0);
  const items = [
    {
      label: "Total DPT",
      value: turnout.total_voters.toLocaleString("id-ID"),
      icon: Users,
      tone: "text-foreground",
    },
    {
      label: "Sudah Memilih",
      value: turnout.voted.toLocaleString("id-ID"),
      subtitle: `${totalVotes.toLocaleString("id-ID")} suara masuk`,
      icon: CheckCircle2,
      tone: "text-primary",
    },
    {
      label: "Belum Memilih",
      value: remaining.toLocaleString("id-ID"),
      icon: Hourglass,
      tone: "text-muted-foreground",
    },
    {
      label: "Partisipasi",
      value: `${turnout.percentage.toFixed(1)}%`,
      icon: Percent,
      tone: "text-success",
    },
  ];
  return (
    <section
      aria-label="Ringkasan KPI pemilihan"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border bg-card p-4 md:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <item.icon
              className={cn("h-4 w-4 shrink-0", item.tone)}
              aria-hidden="true"
            />
          </div>
          <p
            className={cn(
              "mt-2 font-mono text-3xl font-bold tabular-nums md:text-4xl",
              item.tone
            )}
          >
            {item.value}
          </p>
          {item.subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
          )}
        </div>
      ))}
    </section>
  );
}

// =====================================================================
// Candidate bar chart — foto mini + nomor urut + nama + bar warna tenant
// =====================================================================

function CandidateResultsChart({
  rows,
  totalVotes,
}: {
  rows: LiveCountRowWithPhoto[];
  totalVotes: number;
}) {
  const hasAny = totalVotes > 0;
  const maxTotal = Math.max(1, ...rows.map((r) => r.total ?? 0));

  // Padding kanan untuk LabelList (jumlah + persen), supaya tidak kepotong.
  const RIGHT_PAD = 72;
  // Padding kiri untuk nomor urut + nama paslon.
  const LEFT_PAD = 110;

  // Tinggi container menyesuaikan jumlah bar (maks 5 bar, kemudian discroll).
  const barCount = rows.length;
  const chartHeight = Math.min(Math.max(barCount * 36 + 24, 96), 240);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Perolehan Suara per Paslon</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Total suara masuk:{" "}
            <span className="font-mono font-bold text-foreground">
              {totalVotes.toLocaleString("id-ID")}
            </span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Warna mengikuti tema tenant
        </p>
      </div>

      <div className="mt-5 w-full" style={{ height: chartHeight }}>
        {!hasAny ? (
          <EmptyChart message="Menunggu suara pertama" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: RIGHT_PAD, left: 4, bottom: 4 }}
              barCategoryGap={6}
              barGap={4}
            >
              <XAxis
                type="number"
                hide
                domain={[0, maxTotal]}
              />
              <YAxis
                type="category"
                dataKey="candidate_number"
                width={LEFT_PAD}
                tick={(props) => <CandidateYAxisTick {...props} />}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                content={<CandidateTooltip totalVotes={totalVotes} />}
              />
              <Bar
                dataKey="total"
                radius={[4, 4, 4, 4]}
                background={{ fill: "hsl(var(--muted))", radius: 4 }}
                isAnimationActive
                animationDuration={500}
                label={(props) => (
                  <CandidateBarLabel
                    {...props}
                    totalVotes={totalVotes}
                  />
                )}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.candidate_id}
                    fill="hsl(var(--tenant))"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daftar ringkas di bawah chart untuk keterbacaan cepat tanpa hover. */}
      {hasAny && (
        <ul className="mt-5 space-y-2 border-t border-border pt-4">
          {rows.map((row) => {
            const percent =
              totalVotes > 0
                ? (((row.total ?? 0) / totalVotes) * 100).toFixed(2)
                : "0.00";
            return (
              <li
                key={row.candidate_id}
                className="flex items-center gap-3 text-sm"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tenant/10 font-mono text-xs font-bold text-tenant">
                  {row.candidate_number}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {row.name}
                </span>
                <span className="font-mono tabular-nums font-bold">
                  {(row.total ?? 0).toLocaleString("id-ID")}
                </span>
                <span className="w-14 text-right font-mono tabular-nums text-xs text-muted-foreground">
                  {percent}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface AxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: number | string };
}

function CandidateYAxisTick({ x, y, payload }: AxisTickProps) {
  const num = payload?.value;
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        x={-8}
        y={0}
        dy={4}
        textAnchor="end"
        fill="hsl(var(--foreground))"
        fontSize={13}
        fontWeight={600}
        fontFamily="var(--font-mono)"
      >
        No. {num}
      </text>
    </g>
  );
}

interface BarLabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  index?: number;
  totalVotes: number;
}

function CandidateBarLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value = 0,
  totalVotes,
}: BarLabelProps) {
  // Lebar bar minimum 4px untuk konsistensi visual saat value = 0.
  const barWidth = Math.max(width, 4);
  const percent = totalVotes > 0 ? (value / totalVotes) * 100 : 0;
  const label = `${value.toLocaleString("id-ID")} · ${percent.toFixed(1)}%`;
  return (
    <g>
      <text
        x={x + barWidth + 6}
        y={y + height / 2}
        dy={4}
        textAnchor="start"
        fill="hsl(var(--foreground))"
        fontSize={12}
        fontWeight={600}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  );
}

function CandidateTooltip({
  active,
  payload,
  totalVotes,
}: {
  // recharts types are loose; we narrow at the call site.
  active?: boolean;
  payload?: Array<{ payload: LiveCountRowWithPhoto }>;
  totalVotes: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const percent =
    totalVotes > 0 ? ((row.total ?? 0) / totalVotes) * 100 : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground">
        Nomor Urut{" "}
        <span className="font-mono font-bold text-foreground">
          {row.candidate_number}
        </span>
      </p>
      <p className="font-semibold">{row.name}</p>
      <p className="mt-1 font-mono tabular-nums text-sm">
        {(row.total ?? 0).toLocaleString("id-ID")} suara ·{" "}
        <span className="text-primary">{percent.toFixed(2)}%</span>
      </p>
    </div>
  );
}

// =====================================================================
// Velocity line chart — suara masuk per 5 menit, window 120 menit
// =====================================================================

function VelocityChart({
  points,
  hasAnyVote,
}: {
  points: VelocityPoint[];
  hasAnyVote: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Kecepatan Masuk Suara</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            120 menit terakhir · bucket 5 menit
          </p>
        </div>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          Agregat, tanpa identitas pemilih
        </p>
      </div>

      <div className="mt-6 h-[220px] w-full">
        {!hasAnyVote || points.length === 0 ? (
          <EmptyChart message="Belum ada suara dalam window ini" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--tenant))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--tenant))" }}
                isAnimationActive
                animationDuration={400}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Ranking & selisih — badge "Unggul" + selisih dengan posisi di bawahnya
// =====================================================================

function RankingHighlight({
  leader,
  runnerUp,
  gap,
  showGap,
  totalVotes,
  turnout,
}: {
  leader: LiveCountRowWithPhoto | undefined;
  runnerUp: LiveCountRowWithPhoto | undefined;
  gap: number;
  showGap: boolean;
  totalVotes: number;
  turnout: Turnout;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-bold">Peringkat Sementara</h2>

      {!leader ? (
        <div className="mt-4">
          <EmptyChart message="Belum ada suara masuk" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <LeaderCard leader={leader} totalVotes={totalVotes} />

          {showGap && runnerUp && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Selisih suara
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold tabular-nums text-tenant">
                  {gap.toLocaleString("id-ID")}
                </span>
                <span className="text-xs text-muted-foreground">suara</span>
              </div>
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <CandidateAvatar
                  photoUrl={runnerUp.photo_url}
                  candidateNumber={runnerUp.candidate_number}
                  name={runnerUp.name}
                  size={24}
                />
                <p className="min-w-0 flex-1 truncate text-xs">
                  Unggul atas{" "}
                  <span className="font-semibold">
                    No. {runnerUp.candidate_number} · {runnerUp.name}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Partisipasi
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold tabular-nums text-primary">
                {turnout.percentage.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">
                dari {turnout.total_voters.toLocaleString("id-ID")} DPT
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-tenant transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.min(turnout.percentage, 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {turnout.voted.toLocaleString("id-ID")} sudah memilih ·{" "}
              {Math.max(turnout.total_voters - turnout.voted, 0).toLocaleString(
                "id-ID"
              )}{" "}
              belum
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderCard({
  leader,
  totalVotes,
}: {
  leader: LiveCountRowWithPhoto;
  totalVotes: number;
}) {
  const percent =
    totalVotes > 0 ? ((leader.total ?? 0) / totalVotes) * 100 : 0;
  return (
    <div className="relative overflow-hidden rounded-xl border border-tenant/30 bg-tenant/5 p-3">
      <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-tenant px-2 py-0.5 text-[10px] font-bold text-tenant-foreground">
        <Crown className="h-3 w-3" aria-hidden="true" />
        Unggul
      </div>
      <div className="flex items-center gap-3 pr-14">
        <CandidateAvatar
          photoUrl={leader.photo_url}
          candidateNumber={leader.candidate_number}
          name={leader.name}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-semibold text-muted-foreground">
            No. Urut {leader.candidate_number}
          </p>
          <p className="truncate text-sm font-bold leading-tight">
            {leader.name}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-extrabold tabular-nums text-tenant">
            {(leader.total ?? 0).toLocaleString("id-ID")}
          </span>
          <span className="text-xs text-muted-foreground">suara</span>
        </div>
        <span className="font-mono text-sm font-bold tabular-nums text-tenant">
          {percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function CandidateAvatar({
  photoUrl,
  candidateNumber,
  name,
  size,
}: {
  photoUrl: string | null;
  candidateNumber: number;
  name: string;
  size: number;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={`Paslon nomor ${candidateNumber} ${name}`}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-display font-bold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={`Paslon nomor ${candidateNumber} ${name}`}
      role="img"
    >
      {candidateNumber}
    </div>
  );
}

// =====================================================================
// Detail table — fallback untuk panitian yang lebih suka angka mentah
// =====================================================================

function DetailTable({
  rows,
  totalVotes,
}: {
  rows: LiveCountRowWithPhoto[];
  totalVotes: number;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg font-bold">Detail Perolehan</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-4 text-left text-sm font-semibold text-muted-foreground">
                No. Urut
              </th>
              <th className="p-4 text-left text-sm font-semibold text-muted-foreground">
                Nama Paslon
              </th>
              <th className="p-4 text-right text-sm font-semibold text-muted-foreground">
                Jumlah Suara
              </th>
              <th className="p-4 text-right text-sm font-semibold text-muted-foreground">
                Persentase
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.candidate_id}
                className="border-b border-border/50 hover:bg-muted/30"
              >
                <td className="p-4 font-mono font-bold text-lg text-tenant">
                  {row.candidate_number}
                </td>
                <td className="p-4 font-semibold">{row.name}</td>
                <td className="p-4 text-right font-mono tabular-nums">
                  {(row.total ?? 0).toLocaleString("id-ID")}
                </td>
                <td className="p-4 text-right font-medium tabular-nums">
                  {totalVotes > 0
                    ? (((row.total ?? 0) / totalVotes) * 100).toFixed(2) + "%"
                    : "0.00%"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
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
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
