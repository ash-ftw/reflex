import { AlertTriangle, Phone, MessageCircle, Globe, Heart, ExternalLink, ShieldCheck, ThumbsUp, ThumbsDown, Loader2, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { recordSafetyCheck } from "@/lib/tasks.functions";
import { toast } from "sonner";
import { useState } from "react";

const RESOURCES = [
  { icon: Phone, region: "United States", name: "988 Suicide & Crisis Lifeline", action: "Call or text 988", href: "tel:988" },
  { icon: MessageCircle, region: "United States", name: "Crisis Text Line", action: "Text HOME to 741741", href: "sms:741741?body=HOME" },
  { icon: Phone, region: "United Kingdom", name: "Samaritans", action: "Call 116 123", href: "tel:116123" },
  { icon: Globe, region: "International", name: "Find a Helpline", action: "findahelpline.com", href: "https://findahelpline.com" },
];

type SafetyStatus = "safe" | "unsure" | "unsafe";

export function CrisisResources({
  checkinId,
  summary,
  initialSafetyStatus,
  initialResourcesHelpful,
}: {
  checkinId: string;
  summary?: string | null;
  initialSafetyStatus?: SafetyStatus | null;
  initialResourcesHelpful?: boolean | null;
}) {
  const record = useServerFn(recordSafetyCheck);
  const [safety, setSafety] = useState<SafetyStatus | null>(initialSafetyStatus ?? null);
  const [helpful, setHelpful] = useState<boolean | null>(initialResourcesHelpful ?? null);

  const mut = useMutation({
    mutationFn: (vars: { safety_status?: SafetyStatus; resources_helpful?: boolean }) =>
      record({ data: { checkinId, ...vars } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save your response"),
  });

  const setSafetyStatus = (s: SafetyStatus) => {
    setSafety(s);
    mut.mutate({ safety_status: s });
    if (s === "safe") toast.success("Thanks for letting us know. We're glad you're safe right now.");
    if (s === "unsure") toast.message("It's okay to be unsure. Please stay with a hotline or someone you trust.");
    if (s === "unsafe") toast.warning("Please call 988 or your local emergency number right now. You matter.");
  };

  const setHelpfulness = (h: boolean) => {
    setHelpful(h);
    mut.mutate({ resources_helpful: h });
  };

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 shadow-glow"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold">
            You're not alone — please reach out now
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {summary ?? "What you shared sounds serious."} Reflex is an
            emotional fitness app — not a crisis service. A trained human can
            help you right now, free and confidentially.
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {RESOURCES.map((r) => {
              const Icon = r.icon;
              const external = r.href.startsWith("http");
              return (
                <li key={r.name}>
                  <a
                    href={r.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition hover:border-destructive/60 hover:bg-destructive/5"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.region}</div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        {r.action}
                        {external && <ExternalLink className="h-3 w-3" />}
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-background/40 p-3 text-xs text-muted-foreground">
            <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-glow" />
            <p>
              If you're in immediate danger, call your local emergency number
              (911 in the US, 112 in the EU, 999 in the UK). Your life matters.
            </p>
          </div>

          {/* Safety status prompt */}
          <div className="mt-5 rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary-glow" />
              How safe are you feeling right now?
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                { key: "safe", label: "I'm safe right now" },
                { key: "unsure", label: "I'm not sure" },
                { key: "unsafe", label: "I'm not safe" },
              ] as const).map((opt) => {
                const active = safety === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSafetyStatus(opt.key)}
                    disabled={mut.isPending}
                    className={`rounded-lg border px-3 py-2 text-sm transition disabled:opacity-60 ${
                      active
                        ? "border-primary bg-primary/20 text-foreground"
                        : "border-border bg-background/50 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    }`}
                  >
                    {active && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary-glow" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {safety === "unsafe" && (
              <p className="mt-3 text-xs text-destructive">
                Please call 988 (US), 116 123 (UK), or 112 (EU) right now. Stay
                on the line with someone.
              </p>
            )}
          </div>

          {/* Resource helpfulness */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="text-sm text-muted-foreground">
              Were these resources helpful?
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHelpfulness(true)}
                disabled={mut.isPending}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-60 ${
                  helpful === true
                    ? "border-primary bg-primary/20 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Yes
              </button>
              <button
                onClick={() => setHelpfulness(false)}
                disabled={mut.isPending}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-60 ${
                  helpful === false
                    ? "border-primary bg-primary/20 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Not really
              </button>
              {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
          {helpful === false && (
            <p className="mt-2 text-xs text-muted-foreground">
              Thanks for telling us. Try{" "}
              <a className="underline" href="https://findahelpline.com" target="_blank" rel="noreferrer">findahelpline.com</a>{" "}
              for more options in your region, or reach out to someone you trust.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
