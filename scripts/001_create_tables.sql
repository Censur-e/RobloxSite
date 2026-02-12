-- ============================================================
-- 1. PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('SUPER_ADMIN', 'OWNER')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_place_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_superadmin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );

CREATE POLICY "profiles_update_superadmin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_superadmin" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );

CREATE POLICY "profiles_delete_superadmin" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );

-- ============================================================
-- 2. PLACES (Roblox game places)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  secret_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "places_select_authenticated" ON public.places
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "places_insert_authenticated" ON public.places
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "places_update_authenticated" ON public.places
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "places_delete_authenticated" ON public.places
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. PLAYER SNAPSHOTS (live player data from Roblox servers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.player_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  roblox_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  account_age INTEGER NOT NULL DEFAULT 0,
  join_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  ping INTEGER NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  is_alt BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_snapshots_select_authenticated" ON public.player_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "player_snapshots_update_authenticated" ON public.player_snapshots
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "player_snapshots_insert_anon" ON public.player_snapshots
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "player_snapshots_insert_authenticated" ON public.player_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "player_snapshots_update_anon" ON public.player_snapshots
  FOR UPDATE TO anon USING (true);

CREATE POLICY "player_snapshots_delete_anon" ON public.player_snapshots
  FOR DELETE TO anon USING (true);

CREATE POLICY "player_snapshots_delete_authenticated" ON public.player_snapshots
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 4. COMMAND QUEUE (commands sent to Roblox servers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.command_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  server_id TEXT,
  command_type TEXT NOT NULL,
  target_player_id TEXT,
  target_username TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'SUCCESS', 'FAILED', 'EXPIRED')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result_message TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE public.command_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "command_queue_insert_authenticated" ON public.command_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "command_queue_select_authenticated" ON public.command_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "command_queue_select_anon" ON public.command_queue
  FOR SELECT TO anon USING (true);

CREATE POLICY "command_queue_update_anon" ON public.command_queue
  FOR UPDATE TO anon USING (true);

CREATE POLICY "command_queue_update_authenticated" ON public.command_queue
  FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- 5. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "audit_logs_select_authenticated" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 6. Auto-create profile on signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(COALESCE(new.email, ''), '@', 1)),
    COALESCE(new.raw_user_meta_data ->> 'role', 'OWNER')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
