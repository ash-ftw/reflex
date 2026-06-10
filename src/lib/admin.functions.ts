import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const getSafetyQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: queue, error } = await supabaseAdmin
      .from("checkins")
      .select("id, user_id, entry_text, ai_summary, safety_status, resources_helpful, safety_responded_at, created_at, reviewed_at, reviewed_by, reviewer_note, is_crisis")
      .in("safety_status", ["unsafe", "unsure"])
      .order("reviewed_at", { ascending: true, nullsFirst: true })
      .order("safety_responded_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Aggregate helpfulness over the last 12 weeks
    const since = new Date();
    since.setDate(since.getDate() - 7 * 12);
    const { data: responses, error: aggErr } = await supabaseAdmin
      .from("checkins")
      .select("safety_responded_at, resources_helpful, safety_status")
      .gte("safety_responded_at", since.toISOString())
      .not("safety_responded_at", "is", null);
    if (aggErr) throw new Error(aggErr.message);

    const weeks = new Map<string, { week: string; helpful: number; notHelpful: number; total: number; unsafe: number; unsure: number; safe: number }>();
    for (const r of responses ?? []) {
      const d = new Date(r.safety_responded_at as string);
      // Week starting Monday
      const day = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - day);
      const key = d.toISOString().slice(0, 10);
      const bucket = weeks.get(key) ?? { week: key, helpful: 0, notHelpful: 0, total: 0, unsafe: 0, unsure: 0, safe: 0 };
      bucket.total += 1;
      if (r.resources_helpful === true) bucket.helpful += 1;
      if (r.resources_helpful === false) bucket.notHelpful += 1;
      if (r.safety_status === "unsafe") bucket.unsafe += 1;
      else if (r.safety_status === "unsure") bucket.unsure += 1;
      else if (r.safety_status === "safe") bucket.safe += 1;
      weeks.set(key, bucket);
    }
    const aggregates = Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));

    const totals = (responses ?? []).reduce(
      (acc, r) => {
        acc.total += 1;
        if (r.resources_helpful === true) acc.helpful += 1;
        if (r.resources_helpful === false) acc.notHelpful += 1;
        if (r.safety_status === "unsafe") acc.unsafe += 1;
        if (r.safety_status === "unsure") acc.unsure += 1;
        if (r.safety_status === "safe") acc.safe += 1;
        return acc;
      },
      { total: 0, helpful: 0, notHelpful: 0, unsafe: 0, unsure: 0, safe: 0 },
    );

    return { queue: queue ?? [], aggregates, totals };
  });

export const markCheckinReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      checkinId: z.string().uuid(),
      note: z.string().max(2000).optional(),
      clear: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.clear
      ? { reviewed_at: null, reviewed_by: null, reviewer_note: null }
      : { reviewed_at: new Date().toISOString(), reviewed_by: context.userId, reviewer_note: data.note ?? null };
    const { error } = await supabaseAdmin
      .from("checkins")
      .update(patch)
      .eq("id", data.checkinId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_notifications")
      .select(
        "id, kind, read_at, created_at, checkin_id, checkins:checkin_id(entry_text, ai_summary, safety_status, user_id)",
      )
      .eq("admin_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const items = (data ?? []).map((n) => {
      const c = n.checkins as { entry_text?: string; ai_summary?: string | null; safety_status?: string | null } | null;
      return {
        id: n.id,
        kind: n.kind,
        read_at: n.read_at,
        created_at: n.created_at,
        checkin_id: n.checkin_id,
        entry_preview: (c?.entry_text ?? "").slice(0, 220),
        summary: c?.ai_summary ?? null,
        safety_status: c?.safety_status ?? null,
      };
    });
    const unread = items.filter((i) => !i.read_at).length;
    return { items, unread };
  });

export const markAdminNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    let q = supabaseAdmin
      .from("admin_notifications")
      .update({ read_at: now })
      .eq("admin_user_id", context.userId)
      .is("read_at", null);
    if (!data.all && data.ids?.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
