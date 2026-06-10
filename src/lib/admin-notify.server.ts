// Server-only: notifies admins of unsafe check-ins via in-app rows + email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface NotifyArgs {
  checkinId: string;
  entryPreview: string;
  summary: string | null;
}

async function getAdminRecipients() {
  const { data: roleRows, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  const ids = (roleRows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) return [] as Array<{ id: string; email: string | null }>;

  const recipients: Array<{ id: string; email: string | null }> = [];
  for (const id of ids) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    recipients.push({ id, email: data?.user?.email ?? null });
  }
  return recipients;
}

async function trySendEmail(to: string, args: NotifyArgs) {
  // Calls the Lovable Emails transactional route. Silently no-ops if email
  // infrastructure / template is not yet configured for this project.
  try {
    const baseUrl = process.env.SITE_URL ?? "";
    if (!baseUrl) return;
    const res = await fetch(`${baseUrl}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        templateName: "admin-unsafe-alert",
        recipientEmail: to,
        idempotencyKey: `unsafe-${args.checkinId}-${to}`,
        templateData: {
          entryPreview: args.entryPreview,
          summary: args.summary ?? "",
          reviewUrl: `${baseUrl}/admin`,
        },
      }),
    });
    if (!res.ok) console.warn("[admin-notify] email send non-OK", res.status);
  } catch (e) {
    console.warn("[admin-notify] email send failed", e);
  }
}

export async function notifyAdminsOfUnsafeCheckin(args: NotifyArgs) {
  const admins = await getAdminRecipients();
  if (admins.length === 0) return;

  // In-app: idempotent thanks to (admin_user_id, checkin_id, kind) unique index.
  const rows = admins.map((a) => ({
    admin_user_id: a.id,
    checkin_id: args.checkinId,
    kind: "unsafe_checkin",
  }));
  const { error: insErr } = await supabaseAdmin
    .from("admin_notifications")
    .upsert(rows, { onConflict: "admin_user_id,checkin_id,kind", ignoreDuplicates: true });
  if (insErr) console.error("[admin-notify] insert failed", insErr);

  // Email: best-effort to each admin with a known address.
  await Promise.all(
    admins
      .filter((a): a is { id: string; email: string } => !!a.email)
      .map((a) => trySendEmail(a.email, args)),
  );
}
