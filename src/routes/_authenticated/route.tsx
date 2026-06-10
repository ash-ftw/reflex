import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { Brain, LayoutDashboard, History, LogOut, ShieldCheck, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, getAdminNotifications } from "@/lib/admin.functions";
import { useQueryClient } from "@tanstack/react-query";

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
  const qc = useQueryClient();
  const fetchAdmin = useServerFn(checkIsAdmin);
  const fetchNotifs = useServerFn(getAdminNotifications);
  const { data: adminData } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchAdmin(),
    staleTime: 60_000,
  });
  const isAdmin = !!adminData?.isAdmin;
  const { data: notifs } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fetchNotifs(),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  // Realtime: refetch on new admin_notifications inserts for the current admin.
  useEffect(() => {
    if (!isAdmin) return;
    let userId: string | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
    });
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          const row = payload.new as { admin_user_id: string };
          if (!userId || row.admin_user_id === userId) {
            qc.invalidateQueries({ queryKey: ["admin-notifications"] });
            qc.invalidateQueries({ queryKey: ["admin-safety-queue"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  const unread = notifs?.unread ?? 0;

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
            {isAdmin && (
              <>
                <NavItem to="/admin" icon={ShieldCheck} label="Admin" />
                <Link
                  to="/admin"
                  hash="notifications"
                  aria-label={`Admin notifications${unread ? `, ${unread} unread` : ""}`}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface hover:text-foreground"
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </>
            )}
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
