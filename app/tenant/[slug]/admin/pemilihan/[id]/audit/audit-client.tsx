"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { formatDateTimeID } from "@/lib/utils";
import { getAuditLogs, exportAuditLog } from "@/app/actions/report";
import { toast } from "sonner";
import { Search, Filter, ChevronLeft, ChevronRight, Loader2, Download } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  actor_id: string | null;
  actor_label: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

interface AuditClientPanelProps {
  electionId: string;
}

function getActionBadge(action: string) {
  let classes = "bg-secondary text-secondary-foreground";
  if (action.includes("CREATE") || action.includes("INSERT") || action.includes("GENERATE")) {
    classes = "bg-success/10 text-success";
  } else if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("BRANDING")) {
    classes = "bg-info/10 text-info";
  } else if (action.includes("DELETE") || action.includes("REMOVE") || action.includes("BLOCK")) {
    classes = "bg-destructive/10 text-destructive";
  } else if (action.includes("EXPORT") || action.includes("SEND")) {
    classes = "bg-warning/10 text-warning";
  } else if (action.includes("VOTE") || action.includes("CLOSE") || action.includes("PUBLISH")) {
    classes = "bg-primary/10 text-primary";
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {action}
    </span>
  );
}

export function AuditClientPanel({ electionId }: AuditClientPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [actions, setActions] = useState<string[]>([]);

  const loadLogs = useCallback(() => {
    startTransition(async () => {
      const result = await getAuditLogs({
        electionId,
        page,
        pageSize,
        action: actionFilter || undefined,
        from: fromFilter ? new Date(fromFilter).toISOString() : undefined,
        to: toFilter ? new Date(toFilter).toISOString() : undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal memuat log audit.");
        return;
      }
      if (!result.data) {
        toast.error("Data log audit tidak valid.");
        return;
      }
      setLogs(result.data.logs);
      setTotal(result.data.total);
      if (actions.length === 0) {
        const uniqueActions = Array.from(new Set(result.data.logs.map((l) => l.action))).sort();
        setActions(uniqueActions);
      }
    });
  }, [electionId, page, pageSize, actionFilter, fromFilter, toFilter, actions.length]);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExport() {
    startTransition(async () => {
      const result = await exportAuditLog({
        electionId,
        from: fromFilter ? new Date(fromFilter).toISOString() : undefined,
        to: toFilter ? new Date(toFilter).toISOString() : undefined,
        action: actionFilter || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal mengekspor audit log.");
        return;
      }
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log berhasil diunduh.");
    });
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Log Audit Pemilihan
        </h2>
        <button
          onClick={handleExport}
          disabled={isPending}
          className="inline-flex items-center gap-2 h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          Ekspor CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-[200px]"
        >
          <option value="">Semua aksi</option>
          {actions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={fromFilter}
          onChange={(e) => setFromFilter(e.target.value)}
          placeholder="Dari"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-[180px]"
        />
        <input
          type="datetime-local"
          value={toFilter}
          onChange={(e) => setToFilter(e.target.value)}
          placeholder="Sampai"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-[180px]"
        />
        <button
          onClick={() => {
            setActionFilter("");
            setFromFilter("");
            setToFilter("");
          }}
          disabled={isPending}
          className="h-10 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          Reset
        </button>
        <button
          onClick={() => {
            setPage(1);
            loadLogs();
          }}
          disabled={isPending}
          className="inline-flex items-center gap-2 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {isPending && logs.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Tidak ada log audit yang cocok.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 font-semibold w-[180px]">Waktu</th>
                    <th className="text-left p-3 font-semibold w-[160px]">Aksi</th>
                    <th className="text-left p-3 font-semibold w-[180px]">Pelaku</th>
                    <th className="text-left p-3 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-border/50 hover:bg-muted/50">
                      <td className="p-3 font-mono text-xs">{formatDateTimeID(log.created_at)}</td>
                      <td className="p-3">{getActionBadge(log.action)}</td>
                      <td className="p-3 text-sm font-medium">{log.actor_label ?? "sistem"}</td>
                      <td className="p-3 text-xs text-muted-foreground font-mono max-w-[400px] truncate">
                        {JSON.stringify(log.meta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border p-4">
              <p className="text-sm text-muted-foreground">
                Menampilkan {logs.length} dari {total} log
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    setTimeout(loadLogs, 0);
                  }}
                  disabled={isPending || page === 1}
                  className="inline-flex items-center h-9 w-9 justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-60"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setPage((p) => p + 1);
                    setTimeout(loadLogs, 0);
                  }}
                  disabled={isPending || page * pageSize >= total}
                  className="inline-flex items-center h-9 w-9 justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-60"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}