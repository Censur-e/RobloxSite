-- Fix: include assigned_place_id from user metadata in the profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, assigned_place_id)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(COALESCE(new.email, ''), '@', 1)),
    COALESCE(new.raw_user_meta_data ->> 'role', 'OWNER'),
    new.raw_user_meta_data ->> 'assigned_place_id'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_snapshots_place_id ON public.player_snapshots(place_id);
CREATE INDEX IF NOT EXISTS idx_player_snapshots_last_seen ON public.player_snapshots(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_command_queue_status ON public.command_queue(status);
CREATE INDEX IF NOT EXISTS idx_command_queue_place_id ON public.command_queue(place_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_places_place_id ON public.places(place_id);
