
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS safety_status text CHECK (safety_status IN ('safe','unsure','unsafe')),
  ADD COLUMN IF NOT EXISTS resources_helpful boolean,
  ADD COLUMN IF NOT EXISTS safety_responded_at timestamptz;
