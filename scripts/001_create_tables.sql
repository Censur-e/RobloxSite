-- ============================================
-- 1) Create all tables (no RLS yet)
-- ============================================

-- Profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  role text not null default 'VIEWER' check (role in ('ADMIN', 'MODERATOR', 'VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Places table
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

-- Player snapshots (updated by Roblox server)
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

-- Command queue
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

-- Audit logs
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
