import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Activity, CheckCircle2, Circle, Brain, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { analyzeCheckin } from "@/lib/checkin.functions";
import { getDashboardData, toggleTask } from "@/lib/tasks.functions";
import { CrisisResources } from "@/components/CrisisResources";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Today — Reflex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getDashboardData);
  const analyze = useServerFn(analyzeCheckin);
  const toggle = useServerFn(toggleTask);
  const qc = useQueryClient();
  const [entry, setEntry] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  useEffect(() => {
    if (data && data.profile && !data.profile.onboarding_completed) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [data, navigate]);

  const submit = useMutation({
    mutationFn: (text: string) => analyze({ data: { entry: text } }),
    onSuccess: (res) => {
      setEntry("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.crisis) {
        toast.warning("We've shared crisis resources below. You matter.");
      } else {
        toast.success("Check-in saved. Here are your micro-actions.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't analyze entry"),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { taskId: string; completed: boolean }) =>
      toggle({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const greeting = greetingFor(data.profile?.display_name);
  const todayHasEntry = data.latestCheckin && isToday(new Date(data.latestCheckin.created_at));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{greeting}</h1>
      </div>

      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary-glow" />
          {todayHasEntry ? "Want to add another check-in?" : "How are you doing right now?"}
        </div>
        <textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          rows={4}
          placeholder="Tell Reflex about your day — what's on your mind, what's heavy, what's light…"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-input/40 p-4 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          maxLength={4000}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{entry.length}/4000</span>
          <button
            onClick={() => entry.trim().length >= 3 && submit.mutate(entry)}
            disabled={submit.isPending || entry.trim().length < 3}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-primary px-5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submit.isPending ? "Reflecting…" : "Get my actions"}
          </button>
        </div>
      </section>

      {data.latestCheckin?.is_crisis && (
        <CrisisResources
          checkinId={data.latestCheckin.id}
          summary={data.latestCheckin.ai_summary}
          initialSafetyStatus={(data.latestCheckin.safety_status as "safe" | "unsure" | "unsafe" | null) ?? null}
          initialResourcesHelpful={data.latestCheckin.resources_helpful ?? null}
        />
      )}

      {data.latestCheckin && !data.latestCheckin.is_crisis && (
        <section className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Brain} label="Emotion" value={data.latestCheckin.primary_emotion ?? "—"} />
          <Stat icon={Activity} label="Stress" value={`${data.latestCheckin.stress_level ?? "—"}/10`} />
          <Stat icon={Zap} label="Energy" value={`${data.latestCheckin.energy_level ?? "—"}/10`} />
        </section>
      )}

      {data.latestCheckin?.ai_summary && !data.latestCheckin.is_crisis && (
        <section className="glass rounded-2xl p-6">
          <p className="text-base leading-relaxed">{data.latestCheckin.ai_summary}</p>
          {data.latestCheckin.ai_insight && (
            <p className="mt-3 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
              {data.latestCheckin.ai_insight}
            </p>
          )}
        </section>
      )}

      {data.tasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Your micro-actions</h2>
          <div className="space-y-2">
            {data.tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleMut.mutate({ taskId: t.id, completed: !t.completed })}
                className="glass group flex w-full items-start gap-3 rounded-xl p-4 text-left transition hover:bg-surface-elevated"
              >
                {t.completed ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-glow" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`font-medium ${t.completed ? "line-through opacity-60" : ""}`}>{t.title}</span>
                    {t.duration_minutes && (
                      <span className="text-xs text-muted-foreground">{t.duration_minutes} min</span>
                    )}
                    {t.category && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-glow">{t.category}</span>
                    )}
                  </div>
                  {t.description && (
                    <p className={`mt-1 text-sm text-muted-foreground ${t.completed ? "line-through" : ""}`}>{t.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!data.latestCheckin && (
        <p className="text-center text-sm text-muted-foreground">
          Your first check-in will set the baseline. There are no wrong answers.
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold capitalize">{value}</div>
    </div>
  );
}

function greetingFor(name?: string | null) {
  const h = new Date().getHours();
  const base = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}.` : `${base}.`;
}

function isToday(d: Date) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
