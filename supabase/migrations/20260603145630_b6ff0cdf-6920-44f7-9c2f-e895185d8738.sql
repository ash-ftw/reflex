
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  age_range TEXT,
  occupation TEXT,
  communication_style TEXT DEFAULT 'supportive',
  goals TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- checkins
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_text TEXT NOT NULL,
  primary_emotion TEXT,
  stress_level INT,
  energy_level INT,
  confidence_level INT,
  triggers TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  ai_insight TEXT,
  is_crisis BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX checkins_user_created_idx ON public.checkins (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins select" ON public.checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own checkins insert" ON public.checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checkins update" ON public.checkins FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own checkins delete" ON public.checkins FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- microtasks
CREATE TABLE public.microtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_minutes INT,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX microtasks_user_created_idx ON public.microtasks (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.microtasks TO authenticated;
GRANT ALL ON public.microtasks TO service_role;
ALTER TABLE public.microtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks select" ON public.microtasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tasks insert" ON public.microtasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tasks update" ON public.microtasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tasks delete" ON public.microtasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
