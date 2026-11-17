-- =============================================================================
-- Essential English Course — dashboard schema (uang les & data murid)
--
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- (Or with the Supabase CLI: `supabase db push`.)
--
-- Security model: Row Level Security is ON for every table and there are NO
-- policies, so the public anon/publishable key can read or write nothing.
-- All data goes through the Express API, which uses the secret (service role)
-- key and enforces the admin / guru rules itself.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles & profiles (one row per login account in auth.users)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'guru');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) between 2 and 100),
  role        public.app_role not null default 'guru',
  phone       text check (phone is null or length(phone) <= 30),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Kelas (program + level) with its monthly fee
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique check (length(trim(name)) between 1 and 60),
  monthly_fee  integer not null check (monthly_fee >= 0),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Murid — deliberately minimal: name, kelas, guru.
-- archived_at: student stopped (kept for payment history, no new bills).
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 2 and 100),
  class_id     uuid not null references public.classes (id) on delete restrict,
  teacher_id   uuid references public.profiles (id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists students_class_idx   on public.students (class_id);
create index if not exists students_teacher_idx on public.students (teacher_id);

-- ---------------------------------------------------------------------------
-- Uang les: one row per student per month (period = first day of the month).
-- amount_due is a snapshot of the class fee when the row was written, so
-- later fee changes never rewrite past months.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  period       date not null check (extract(day from period) = 1),
  amount_due   integer not null check (amount_due >= 0),
  amount_paid  integer not null default 0 check (amount_paid >= 0),
  paid_on      date,
  method       text check (method in ('tunai', 'transfer', 'qris', 'lainnya')),
  note         text check (note is null or length(note) <= 300),
  recorded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (student_id, period)
);
create index if not exists payments_period_idx on public.payments (period);

-- ---------------------------------------------------------------------------
-- Target uang les per month
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_targets (
  period      date primary key check (extract(day from period) = 1),
  amount      integer not null check (amount >= 0),
  note        text check (note is null or length(note) <= 300),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activity log: who changed what (money needs a paper trail)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'classes', 'students', 'payments'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Lock everything down: RLS on, no policies, no grants for public roles.
-- The service role (used only by the Express server) bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.classes         enable row level security;
alter table public.students        enable row level security;
alter table public.payments        enable row level security;
alter table public.monthly_targets enable row level security;
alter table public.audit_log       enable row level security;

revoke all on public.profiles, public.classes, public.students, public.payments,
              public.monthly_targets, public.audit_log
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starting classes, from the fees published on the website
-- (Kindergarten Rp 200.000/bulan, +Rp 20.000 per program).
-- Edit them anytime in the dashboard (menu Kelas).
-- ---------------------------------------------------------------------------
insert into public.classes (name, monthly_fee, sort_order) values
  ('Kindergarten 1', 200000, 10), ('Kindergarten 2', 200000, 11), ('Kindergarten 3', 200000, 12),
  ('Standard 1',     220000, 20), ('Standard 2',     220000, 21), ('Standard 3',     220000, 22),
  ('Primary 1',      240000, 30), ('Primary 2',      240000, 31), ('Primary 3',      240000, 32),
  ('Elementary 1',   260000, 40), ('Elementary 2',   260000, 41), ('Elementary 3',   260000, 42),
  ('Intermediate 1', 280000, 50), ('Intermediate 2', 280000, 51), ('Intermediate 3', 280000, 52),
  ('Pre-TOEFL',      300000, 60)
on conflict (name) do nothing;
