import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const recordSafetyCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      checkinId: z.string().uuid(),
      safety_status: z.enum(["safe", "unsure", "unsafe"]).optional(),
      resources_helpful: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      safety_responded_at: string;
      safety_status?: "safe" | "unsure" | "unsafe";
      resources_helpful?: boolean;
    } = { safety_responded_at: new Date().toISOString() };
    if (data.safety_status !== undefined) patch.safety_status = data.safety_status;
    if (data.resources_helpful !== undefined) patch.resources_helpful = data.resources_helpful;
    const { data: updated, error } = await supabase
      .from("checkins")
      .update(patch)
      .eq("id", data.checkinId)
      .eq("user_id", userId)
      .select("id, safety_status, entry_text, ai_summary")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (updated?.safety_status === "unsafe") {
      try {
        const { notifyAdminsOfUnsafeCheckin } = await import("./admin-notify.server");
        await notifyAdminsOfUnsafeCheckin({
          checkinId: updated.id,
          entryPreview: (updated.entry_text ?? "").slice(0, 300),
          summary: updated.ai_summary,
        });
      } catch (e) {
        console.error("[safety] notifyAdminsOfUnsafeCheckin failed", e);
      }
    }

    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ taskId: z.string().uuid(), completed: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("microtasks")
      .update({
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: latestCheckin }, { data: recentCheckins }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("checkins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("checkins")
        .select("id, created_at, primary_emotion, stress_level, energy_level")
        .order("created_at", { ascending: false })
        .limit(14),
    ]);

    let tasks: Array<{
      id: string; title: string; description: string | null;
      category: string | null; duration_minutes: number | null; completed: boolean;
    }> = [];
    if (latestCheckin) {
      const { data } = await supabase
        .from("microtasks")
        .select("id, title, description, category, duration_minutes, completed")
        .eq("checkin_id", latestCheckin.id)
        .order("created_at", { ascending: true });
      tasks = data ?? [];
    }

    return { profile, latestCheckin, recentCheckins: recentCheckins ?? [], tasks };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      display_name: z.string().min(1).max(80),
      age_range: z.string().max(40),
      occupation: z.string().max(80),
      communication_style: z.enum(["supportive", "direct", "playful"]),
      goals: z.array(z.string().max(40)).max(6),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        age_range: data.age_range,
        occupation: data.occupation,
        communication_style: data.communication_style,
        goals: data.goals,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
