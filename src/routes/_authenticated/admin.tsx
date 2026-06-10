import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ShieldAlert, ThumbsUp, ThumbsDown, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getSafetyQueue, markCheckinReviewed, getAdminNotifications, markAdminNotificationsRead } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Reflex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchQueue = useServerFn(getSafetyQueue);
  const review = useServerFn(markCheckinReviewed);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-safety-queue"],
    queryFn: () => fetchQueue(),
    retry: false,
  });

  const mut = useMutation({
    mutationFn: (vars: { checkinId: string; clear?: boolean; note?: string }) =>
      review({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-safety-queue"] });
      toast.success("Updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass mx-auto max-w-md rounded-2xl p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-3 font-display text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "You don't have access to this page."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const queue = filter === "open"
    ? data.queue.filter((q) => !q.reviewed_at)
    : data.queue;

  const helpfulPct = data.totals.helpful + data.totals.notHelpful > 0
    ? Math.round((data.totals.helpful / (data.totals.helpful + data.totals.notHelpful)) * 100)
    : null;

  const maxWeek = data.aggregates.reduce((m, w) => Math.max(m, w.total), 1);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-primary-glow">Safety operations</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Admin review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Check-ins flagged "unsafe" or "unsure" and aggregate helpfulness signal from the past 12 weeks.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Unsafe (12w)" value={String(data.totals.unsafe)} accent="destructive" />
        <Stat label="Unsure (12w)" value={String(data.totals.unsure)} />
        <Stat label="Safe (12w)" value={String(data.totals.safe)} />
        <Stat
          label="Resources helpful"
          value={helpfulPct !== null ? `${helpfulPct}%` : "—"}
          sub={`${data.totals.helpful} 👍 · ${data.totals.notHelpful} 👎`}
        />
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Weekly safety responses</h2>
        <p className="mt-1 text-xs text-muted-foreground">Stacked by reported safety status. Hover bars for counts.</p>
        <div className="mt-5 flex h-48 items-end gap-2">
          {data.aggregates.length === 0 && (
            <p className="m-auto text-sm text-muted-foreground">No safety responses yet.</p>
          )}
          {data.aggregates.map((w) => {
            const h = (w.total / maxWeek) * 100;
            const unsafeH = (w.unsafe / w.total) * h;
            const unsureH = (w.unsure / w.total) * h;
            const safeH = (w.safe / w.total) * h;
            return (
              <div
                key={w.week}
                className="group relative flex flex-1 flex-col-reverse"
                title={`Week of ${w.week} — safe ${w.safe}, unsure ${w.unsure}, unsafe ${w.unsafe} (${w.helpful}👍/${w.notHelpful}👎)`}
              >
                <div style={{ height: `${safeH}%` }} className="w-full bg-primary/50" />
                <div style={{ height: `${unsureH}%` }} className="w-full bg-amber-500/70" />
                <div style={{ height: `${unsafeH}%` }} className="w-full rounded-t bg-destructive" />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                  {w.week.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex gap-4 text-xs text-muted-foreground">
          <Legend color="bg-destructive" label="Unsafe" />
          <Legend color="bg-amber-500/70" label="Unsure" />
          <Legend color="bg-primary/50" label="Safe" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Review queue</h2>
          <div className="flex gap-1 rounded-full border border-border bg-input/40 p-1 text-xs">
            <button
              onClick={() => setFilter("open")}
              className={`rounded-full px-3 py-1 ${filter === "open" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Open ({data.queue.filter((q) => !q.reviewed_at).length})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1 ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              All ({data.queue.length})
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Nothing in the queue. 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {queue.map((c) => (
              <article key={c.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    c.safety_status === "unsafe"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-amber-500/20 text-amber-300"
                  }`}>
                    {c.safety_status}
                  </span>
                  {c.is_crisis && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                      <AlertTriangle className="h-3 w-3" /> crisis
                    </span>
                  )}
                  {c.resources_helpful === true && <ThumbsUp className="h-3.5 w-3.5 text-primary-glow" />}
                  {c.resources_helpful === false && <ThumbsDown className="h-3.5 w-3.5 text-destructive" />}
                  <span className="ml-auto">
                    {c.safety_responded_at && new Date(c.safety_responded_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{c.entry_text}</p>
                {c.ai_summary && (
                  <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">{c.ai_summary}</p>
                )}
                <div className="mt-4 text-[11px] text-muted-foreground">
                  user <code className="rounded bg-input/40 px-1.5 py-0.5">{c.user_id.slice(0, 8)}…</code>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {c.reviewed_at ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary-glow">
                        <Check className="h-3.5 w-3.5" /> Reviewed {new Date(c.reviewed_at).toLocaleDateString()}
                      </span>
                      {c.reviewer_note && <span className="text-xs text-muted-foreground">"{c.reviewer_note}"</span>}
                      <button
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ checkinId: c.id, clear: true })}
                        className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-surface-elevated"
                      >
                        <RotateCcw className="h-3 w-3" /> Reopen
                      </button>
                    </>
                  ) : (
                    <ReviewForm
                      pending={mut.isPending}
                      onSubmit={(note) => mut.mutate({ checkinId: c.id, note })}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewForm({ pending, onSubmit }: { pending: boolean; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (action taken, follow-up…)"
        maxLength={2000}
        className="min-w-0 flex-1 rounded-full border border-border bg-input/40 px-4 py-2 text-xs outline-none focus:border-primary"
      />
      <button
        disabled={pending}
        onClick={() => onSubmit(note)}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-glow disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Mark reviewed
      </button>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "destructive" }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${color}`} /> {label}
    </span>
  );
}
