import { AlertTriangle, Phone, MessageCircle, Globe, Heart, ExternalLink } from "lucide-react";

const RESOURCES = [
  {
    icon: Phone,
    region: "United States",
    name: "988 Suicide & Crisis Lifeline",
    action: "Call or text 988",
    href: "tel:988",
  },
  {
    icon: MessageCircle,
    region: "United States",
    name: "Crisis Text Line",
    action: "Text HOME to 741741",
    href: "sms:741741?body=HOME",
  },
  {
    icon: Phone,
    region: "United Kingdom",
    name: "Samaritans",
    action: "Call 116 123",
    href: "tel:116123",
  },
  {
    icon: Globe,
    region: "International",
    name: "Find a Helpline",
    action: "findahelpline.com",
    href: "https://findahelpline.com",
  },
];

export function CrisisResources({ summary }: { summary?: string | null }) {
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
            {summary ??
              "What you shared sounds serious."}{" "}
            Reflex is an emotional fitness app — not a crisis service. A trained
            human can help you right now, free and confidentially.
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
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {r.region}
                      </div>
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
              If you're in immediate danger, please call your local emergency
              number (911 in the US, 112 in the EU, 999 in the UK). Your life
              matters.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
