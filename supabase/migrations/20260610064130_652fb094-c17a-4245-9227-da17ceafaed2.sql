CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'unsafe_checkin',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_notifications_admin_unread_idx
  ON public.admin_notifications (admin_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX admin_notifications_unique_per_admin
  ON public.admin_notifications (admin_user_id, checkin_id, kind);

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read own notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (auth.uid() = admin_user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update own notifications"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = admin_user_id AND public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;