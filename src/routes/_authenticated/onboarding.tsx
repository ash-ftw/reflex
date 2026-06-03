import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { completeOnboarding } from "@/lib/tasks.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Reflex" }] }),
  component: Onboarding,
});

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const STYLES = [
  { id: "supportive", label: "Warm & supportive", body: "Gentle tone, validating language." },
  { id: "direct", label: "Direct & practical", body: "Brief, focused on actions." },
  { id: "playful", label: "Playful & light", body: "Encouraging with a sense of humor." },
] as const;
const GOALS = ["Reduce stress", "Improve focus", "Build confidence", "Better emotional regulation", "Sleep better", "Stay motivated"];

function Onboarding() {
  const navigate = useNavigate();
  const submit = useServerFn(completeOnboarding);
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("25-34");
  const [occupation, setOccupation] = useState("");
  const [style, setStyle] = useState<"supportive" | "direct" | "playful">("supportive");
  const [goals, setGoals] = useState<string[]>([]);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          display_name: name.trim() || "friend",
          age_range: age,
          occupation: occupation.trim(),
          communication_style: style,
          goals,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });

  const steps = 3;
  const canNext = (step === 0 && name.trim().length > 0) || step === 1 || (step === 2 && goals.length > 0);

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary-glow" /> Setting up your space
      </div>

      <div className="mb-6 flex gap-2">
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gradient-primary" : "bg-border"}`} />
        ))}
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        {step === 0 && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-semibold">What should we call you?</h1>
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              className="h-12 w-full rounded-lg border border-border bg-input/40 px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="mb-1.5 block uppercase tracking-wider text-muted-foreground">Age range</span>
                <select value={age} onChange={(e) => setAge(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-input/40 px-3 text-sm">
                  {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1.5 block uppercase tracking-wider text-muted-foreground">Occupation</span>
                <input value={occupation} onChange={(e) => setOccupation(e.target.value)}
                  placeholder="Student, designer…"
                  className="h-11 w-full rounded-lg border border-border bg-input/40 px-3 text-sm" />
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-semibold">How should Reflex talk to you?</h1>
            <div className="space-y-2">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${style === s.id ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-elevated"}`}>
                  <div className="font-medium">{s.label}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{s.body}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-semibold">What do you want to work on?</h1>
            <p className="text-sm text-muted-foreground">Pick a few. You can change these anytime.</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const on = goals.includes(g);
                return (
                  <button key={g} onClick={() => setGoals(on ? goals.filter((x) => x !== g) : [...goals, g])}
                    className={`rounded-full border px-4 py-2 text-sm transition ${on ? "border-primary bg-primary/15 text-primary-glow" : "border-border bg-surface hover:bg-surface-elevated"}`}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30">
            Back
          </button>
          {step < steps - 1 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-primary px-6 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => mut.mutate()} disabled={!canNext || mut.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-primary px-6 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50">
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
