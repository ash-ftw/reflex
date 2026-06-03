import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Loader2, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — Reflex" }] }),
  component: HistoryPage,
});

export const getHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("checkins")
      .select("id, created_at, primary_emotion, stress_level, energy_level, entry_text, ai_summary")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function HistoryPage() {
  const fn = useServerFn(getHistory);
  const { data, isLoading } = useQuery({ queryKey: ["history"], queryFn: () => fn() });

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Your reflections</h1>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins yet. Once you start, they'll show up here.</p>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <article key={c.id} className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(c.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                {c.primary_emotion && (
                  <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-glow">{c.primary_emotion}</span>
                )}
                {typeof c.stress_level === "number" && (
                  <span className="ml-1 text-[11px]">stress {c.stress_level}/10</span>
                )}
                {typeof c.energy_level === "number" && (
                  <span className="text-[11px]">· energy {c.energy_level}/10</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed">{c.entry_text}</p>
              {c.ai_summary && (
                <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">{c.ai_summary}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
