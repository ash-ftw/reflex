import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { Brain, LayoutDashboard, History, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }
  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-aurora opacity-50" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-semibold">Reflex</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Today" />
            <NavItem to="/history" icon={History} label="History" />
            <button
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </header>
        <main className="flex-1 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
      activeProps={{ className: "bg-surface text-foreground" }}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
