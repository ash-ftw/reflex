import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Sparkles, Activity, Shield, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reflex — AI-Powered Emotional Fitness" },
      { name: "description", content: "An AI companion that turns how you feel into small, doable actions. Build resilience, self-awareness and healthier habits." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold">Reflex</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/auth" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">Sign in</Link>
            <Link
              to="/auth"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gradient-primary px-5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <section className="mx-auto max-w-4xl px-6 pt-20 pb-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary-glow" />
            AI-powered emotional fitness
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Train your <span className="text-gradient">emotional fitness</span> like a muscle.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Reflex turns how you feel into 3–5 small daily actions. Notice patterns, build resilience, and grow self-awareness — without replacing therapy.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-primary px-7 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Start your first check-in <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex h-12 items-center rounded-full border border-border bg-surface/60 px-7 text-sm font-medium backdrop-blur transition hover:bg-surface-elevated"
            >
              How it works
            </a>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Brain, title: "Daily check-in", body: "Tell Reflex how your day is going in plain language. No mood scales, no quizzes." },
              { icon: Activity, title: "AI reads patterns", body: "Reflex detects emotion, stress and triggers — and how today fits your week." },
              { icon: Sparkles, title: "Micro-actions", body: "Get 3–5 small tasks under 15 minutes, tailored to how you actually feel right now." },
            ].map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-24">
          <div className="glass rounded-3xl p-8 sm:p-12">
            <div className="flex items-start gap-4">
              <Shield className="h-6 w-6 shrink-0 text-primary-glow" />
              <div>
                <h3 className="font-display text-xl font-semibold">Reflex is a fitness tool, not a therapist.</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  We help you build emotional awareness and daily habits. If something serious surfaces, we'll point you to real human support — never try to diagnose or treat you. Your data is yours.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Reflex. Built for emotional fitness.
        </footer>
      </div>
    </div>
  );
}
