-- ============================================
-- Roblox Admin Panel - Full Database Schema
-- ============================================

-- 1) Profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  role text not null default 'VIEWER' check (role in ('ADMIN', 'MODERATOR', 'VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admins can see all profiles; others see only their own
create policy "profiles_select" on public.profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "profiles_insert" on public.profiles
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "profiles_update" on public.profiles
  for update using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "profiles_delete" on public.profiles
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- 2) Places table
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  name text not null,
  secret_key text not null,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.places enable row level security;

create policy "places_select" on public.places
  for select using (auth.uid() is not null);

create policy "places_insert" on public.places
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "places_update" on public.places
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "places_delete" on public.places
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- 3) Player snapshots (updated by Roblox server)
create table if not exists public.player_snapshots (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  server_id text not null,
  roblox_user_id text not null,
  username text not null,
  display_name text not null,
  account_age integer not null default 0,
  join_time timestamptz not null default now(),
  ping integer not null default 0,
  is_banned boolean not null default false,
  is_suspicious boolean not null default false,
  is_alt boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.player_snapshots enable row level security;

create policy "player_snapshots_select" on public.player_snapshots
  for select using (auth.uid() is not null);

-- Service role handles inserts from the API
create policy "player_snapshots_insert" on public.player_snapshots
  for insert with check (true);

create policy "player_snapshots_update" on public.player_snapshots
  for update using (true);

create policy "player_snapshots_delete" on public.player_snapshots
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'MODERATOR'))
  );

-- Index for fast lookups
create index if not exists idx_player_snapshots_place_server
  on public.player_snapshots(place_id, server_id);

create index if not exists idx_player_snapshots_roblox_user
  on public.player_snapshots(roblox_user_id);

-- 4) Command queue
create table if not exists public.command_queue (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  server_id text,
  command_type text not null,
  target_player_id text,
  target_username text,
  payload jsonb not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'SUCCESS', 'FAILED', 'EXPIRED')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  executed_at timestamptz,
  result_message text,
  expires_at timestamptz default (now() + interval '5 minutes')
);

alter table public.command_queue enable row level security;

create policy "command_queue_select" on public.command_queue
  for select using (auth.uid() is not null);

create policy "command_queue_insert" on public.command_queue
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'MODERATOR'))
  );

create policy "command_queue_update" on public.command_queue
  for update using (true);

-- Index for polling
create index if not exists idx_command_queue_pending
  on public.command_queue(place_id, status) where status = 'PENDING';

-- 5) Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select" on public.audit_logs
  for select using (auth.uid() is not null);

create policy "audit_logs_insert" on public.audit_logs
  for insert with check (true);

-- Index for time-based queries
create index if not exists idx_audit_logs_created
  on public.audit_logs(created_at desc);

create index if not exists idx_audit_logs_user
  on public.audit_logs(user_id);

-- 6) Auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'VIEWER')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
