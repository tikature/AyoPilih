-- =====================================================================
-- AYOPILIH.ID — DATABASE SCHEMA (Supabase / PostgreSQL)
-- Jalankan di Supabase Dashboard > SQL Editor > New Query.
-- Aman dijalankan ulang (idempotent) selama data belum produksi.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. ENUM
-- ---------------------------------------------------------------------
do $$ begin
  create type plan_type       as enum ('STARTER', 'PRO', 'ENTERPRISE');
  create type member_role     as enum ('OWNER', 'ADMIN', 'VIEWER');
  create type voting_mode     as enum ('ONLINE_ONLY', 'OFFLINE_TPS', 'HYBRID');
  create type election_status as enum ('DRAFT', 'SCHEDULED', 'ONGOING', 'CLOSED', 'ARCHIVED');
  create type voter_status    as enum ('UNINVITED', 'SENT', 'VOTED', 'BLOCKED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 0b. PLATFORM ADMINS (Super Admin AyoPilih)
-- Entitas terpisah dari tenant_members. Tidak ada relasi ke tenant.
-- ---------------------------------------------------------------------
create table if not exists public.platform_admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  email       text not null,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_platform_admins_email on public.platform_admins(email);

-- RLS: tidak boleh dibaca lewat anon/authenticated key sama sekali.
-- Hanya service role (via createAdminClient) yang bisa akses.
alter table public.platform_admins enable row level security;
drop policy if exists platform_admins_no_public on public.platform_admins;
create policy platform_admins_no_public on public.platform_admins
  for all using (false);

-- Helper function untuk RLS/platform check
create or replace function public.is_platform_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and is_active = true
  );
$$;

-- ---------------------------------------------------------------------
-- 1. TENANTS
-- ---------------------------------------------------------------------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  slug          text not null unique
                check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$'),
  institution   text,                                  -- SMA / SMK / Universitas / Organisasi
  logo_url      text,
  favicon_url   text,                                  -- favicon subdomain (PNG/ICO, tersedia semua paket)
  theme_color   text not null default '#C81D1D',
  plan          plan_type not null default 'STARTER',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_tenants_slug on public.tenants(slug);

-- Migrasi untuk proyek yang sudah ada: tambah kolom favicon_url jika belum ada.
-- Jalankan baris di bawah ini secara terpisah bila tabel tenants sudah terisi.
-- alter table public.tenants add column if not exists favicon_url text;

-- Slug yang tidak boleh dipakai tenant (bentrok dengan route sistem)
create table if not exists public.reserved_slugs (slug text primary key);
insert into public.reserved_slugs(slug) values
  ('www'),('app'),('admin'),('api'),('auth'),('masuk'),('daftar'),('harga'),
  ('panduan'),('blog'),('docs'),('status'),('cdn'),('mail'),('support'),('cek')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. TENANT MEMBERS (panitia)
-- ---------------------------------------------------------------------
create table if not exists public.tenant_members (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null default 'ADMIN',
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists idx_members_user on public.tenant_members(user_id);

-- ---------------------------------------------------------------------
-- 3. ELECTIONS
-- ---------------------------------------------------------------------
create table if not exists public.elections (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  slug              text not null,
  title             text not null,
  subtitle          text,
  description       text,                       -- sambutan / tata tertib (markdown ringan)
  banner_url        text,
  timeline          jsonb not null default '[]'::jsonb,
  contact_info      text,
  voting_mode       voting_mode  not null default 'ONLINE_ONLY',
  status            election_status not null default 'DRAFT',
  start_time        timestamptz not null,
  end_time          timestamptz not null,
  kiosk_pin_hash    text,
  show_candidates_before_login boolean not null default true,
  show_public_result           boolean not null default false,
  allow_abstain     boolean not null default false,   -- opsi kotak kosong
  max_voters        integer,                          -- diisi dari kuota paket
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, slug),
  check (end_time > start_time)
);
create index if not exists idx_elections_tenant on public.elections(tenant_id);
create index if not exists idx_elections_status on public.elections(status);

-- ---------------------------------------------------------------------
-- 4. CANDIDATES
-- ---------------------------------------------------------------------
create table if not exists public.candidates (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null references public.elections(id) on delete cascade,
  candidate_number  integer not null check (candidate_number > 0),
  name              text not null,              -- nama ketua
  running_mate      text,                       -- nama wakil (opsional)
  short_bio         text,
  vision            text,
  mission           text,
  photo_url         text,
  created_at        timestamptz not null default now(),
  unique (election_id, candidate_number)
);
create index if not exists idx_candidates_election on public.candidates(election_id);

-- ---------------------------------------------------------------------
-- 5. VOTERS (DPT)
-- ---------------------------------------------------------------------
create table if not exists public.voters (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references public.elections(id) on delete cascade,
  identifier    text not null,                 -- NISN / NIM / NIK
  name          text not null,
  group_name    text,                          -- kelas / prodi / angkatan
  email         text,
  phone         text,
  token_hash    text,                          -- SHA-256(token + pepper)
  status        voter_status not null default 'UNINVITED',
  has_voted     boolean not null default false,
  voted_at      timestamptz,
  created_at    timestamptz not null default now(),
  unique (election_id, identifier)
);
create index if not exists idx_voters_election on public.voters(election_id);
create unique index if not exists idx_voters_token
  on public.voters(token_hash) where token_hash is not null;

-- ---------------------------------------------------------------------
-- 6. VOTE SESSIONS (sesi bilik suara, umur pendek)
-- ---------------------------------------------------------------------
create table if not exists public.vote_sessions (
  id                 uuid primary key default gen_random_uuid(),
  voter_id           uuid not null references public.voters(id) on delete cascade,
  election_id        uuid not null references public.elections(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at         timestamptz not null,
  used               boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_sessions_expiry on public.vote_sessions(expires_at);

-- ---------------------------------------------------------------------
-- 7. VOTES — TIDAK ADA voter_id. TITIK.
-- ---------------------------------------------------------------------
create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  election_id  uuid not null references public.elections(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete restrict, -- null = abstain/kotak kosong
  vote_hash    text not null unique,          -- kode bukti untuk pemilih
  created_at   timestamptz not null default date_trunc('minute', now())  -- fuzz waktu
);
create index if not exists idx_votes_election   on public.votes(election_id);
create index if not exists idx_votes_candidate  on public.votes(candidate_id);

-- ---------------------------------------------------------------------
-- 8. AUDIT LOGS
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  election_id uuid references public.elections(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_label text,
  action      text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_tenant on public.audit_logs(tenant_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8b. RATE LIMITS (fallback kalau UPSTASH_REDIS_REST_URL tidak disetel)
-- Digunakan oleh Server Action `verifyToken` & `verifyKioskToken`
-- (lihat SECURITY.md §4).
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  key                    text primary key,      -- mis. "verify-token:1.2.3.4"
  count                  integer not null default 0,
  first_at               timestamptz not null default now(),
  last_at                timestamptz not null default now(),
  consecutive_failures   integer not null default 0,
  backoff_until          timestamptz
);
create index if not exists idx_rate_limits_first_at on public.rate_limits(first_at);

-- Bersihkan baris yang sudah lewat jendela 10 menit (jalankan cron harian)
-- atau dipanggil dari Server Action saat akses pertama.

-- =====================================================================
-- 9. HELPER FUNCTIONS
-- =====================================================================

-- Cek apakah user yang login adalah anggota tenant tertentu
create or replace function public.is_tenant_member(t_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = t_id and m.user_id = auth.uid()
  );
$$;

-- Cek keanggotaan lewat election_id
create or replace function public.is_election_member(e_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.elections e
    join public.tenant_members m on m.tenant_id = e.tenant_id
    where e.id = e_id and m.user_id = auth.uid()
  );
$$;

-- Trigger: auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_tenants_touch on public.tenants;
create trigger trg_tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_elections_touch on public.elections;
create trigger trg_elections_touch before update on public.elections
  for each row execute function public.touch_updated_at();

-- Trigger: owner otomatis jadi member saat tenant dibuat
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_members(tenant_id, user_id, role)
  values (new.id, new.owner_id, 'OWNER')
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists trg_tenant_owner_member on public.tenants;
create trigger trg_tenant_owner_member after insert on public.tenants
  for each row execute function public.add_owner_as_member();

-- =====================================================================
-- 10. FUNGSI INTI: CAST VOTE (atomic, anti double-voting)
-- Dipanggil dari Server Action memakai service role.
-- Mengunci baris voter, cek has_voted, insert vote, tandai voted.
-- =====================================================================
create or replace function public.cast_vote(
  p_voter_id     uuid,
  p_election_id  uuid,
  p_candidate_id uuid,
  p_vote_hash    text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_has_voted boolean;
  v_status    voter_status;
  v_mode      voting_mode;
  v_start     timestamptz;
  v_end       timestamptz;
  v_estatus   election_status;
begin
  -- Kunci baris pemilih supaya request paralel tidak bisa lolos dua kali
  select has_voted, status into v_has_voted, v_status
  from public.voters
  where id = p_voter_id and election_id = p_election_id
  for update;

  if not found then
    raise exception 'VOTER_NOT_FOUND';
  end if;
  if v_status = 'BLOCKED' then
    raise exception 'VOTER_BLOCKED';
  end if;
  if v_has_voted then
    raise exception 'ALREADY_VOTED';
  end if;

  select voting_mode, start_time, end_time, status
    into v_mode, v_start, v_end, v_estatus
  from public.elections where id = p_election_id;

  if v_estatus not in ('ONGOING', 'SCHEDULED') then
    raise exception 'ELECTION_NOT_OPEN';
  end if;
  if now() < v_start or now() > v_end then
    raise exception 'OUTSIDE_VOTING_WINDOW';
  end if;

  -- Kandidat harus milik pemilihan ini (null = abstain)
  if p_candidate_id is not null then
    perform 1 from public.candidates
     where id = p_candidate_id and election_id = p_election_id;
    if not found then
      raise exception 'INVALID_CANDIDATE';
    end if;
  end if;

  insert into public.votes(election_id, candidate_id, vote_hash)
  values (p_election_id, p_candidate_id, p_vote_hash);

  update public.voters
     set has_voted = true, status = 'VOTED', voted_at = now()
   where id = p_voter_id;

  return p_vote_hash;
end; $$;

-- Rekap suara (aman dipanggil publik jika show_public_result = true)
create or replace function public.get_live_count(p_election_id uuid)
returns table (candidate_id uuid, candidate_number int, name text, total bigint)
language sql security definer stable set search_path = public as $$
  select c.id, c.candidate_number, c.name, count(v.id)
  from public.candidates c
  left join public.votes v on v.candidate_id = c.id
  where c.election_id = p_election_id
  group by c.id, c.candidate_number, c.name
  order by c.candidate_number;
$$;

-- Angka partisipasi
create or replace function public.get_turnout(p_election_id uuid)
returns table (total_voters bigint, voted bigint)
language sql security definer stable set search_path = public as $$
  select count(*), count(*) filter (where has_voted)
  from public.voters where election_id = p_election_id;
$$;

-- Kecepatan masuk suara (velocity), aggregate per bucket-menit.
-- Tidak pernah mengembalikan voter_id, candidate_id, atau baris individual.
-- votes.created_at sudah date_trunc('minute', now()) jadi bucket 1 menit aman.
-- Untuk pemilihan < 50 DPT, turunkan ke bucket jam (date_trunc('hour', ...)).
create or replace function public.get_vote_velocity(
  p_election_id uuid,
  p_bucket_minutes int default 5,
  p_window_minutes int default 120
)
returns table (bucket_start timestamptz, total bigint)
language sql security definer stable set search_path = public as $$
  with params as (
    select
      greatest(1, least(coalesce(p_bucket_minutes, 5), 60))::int as bucket,
      greatest(p_bucket_minutes, coalesce(p_window_minutes, 120))::int as window_len
  ),
  series as (
    select generate_series(
      date_trunc('minute', now() - ((select window_len from params) || ' minutes')::interval),
      date_trunc('minute', now()),
      ((select bucket from params) || ' minutes')::interval
    ) as bucket_start
  ),
  total_dpt as (
    select count(*)::bigint as n from public.voters where election_id = p_election_id
  )
  select
    s.bucket_start,
    coalesce(count(v.id), 0)::bigint as total
  from series s
  cross join total_dpt
  left join public.votes v
    on v.election_id = p_election_id
   and v.created_at >= s.bucket_start
   and v.created_at <  s.bucket_start + ((select bucket from params) || ' minutes')::interval
  -- Untuk pemilihan kecil, fuzz agregat lagi: hanya kembalikan bucket
  -- yang total kumulatifnya tidak bisa di-korelasi 1-buat-1 ke voters.voted_at.
  where (select n from total_dpt) >= 50
  group by s.bucket_start
  union all
  -- Fallback untuk pemilihan kecil: agregat per jam, tetap aman.
  select
    date_trunc('hour', s.bucket_start) as bucket_start,
    coalesce(count(v.id), 0)::bigint as total
  from series s
  cross join total_dpt
  left join public.votes v
    on v.election_id = p_election_id
   and v.created_at >= date_trunc('hour', s.bucket_start)
   and v.created_at <  date_trunc('hour', s.bucket_start) + interval '1 hour'
  where (select n from total_dpt) < 50
  group by date_trunc('hour', s.bucket_start)
  order by bucket_start;
$$;

-- =====================================================================
-- 11. ROW LEVEL SECURITY
-- =====================================================================
alter table public.tenants        enable row level security;
alter table public.tenant_members enable row level security;
alter table public.elections      enable row level security;
alter table public.candidates     enable row level security;
alter table public.voters         enable row level security;
alter table public.votes          enable row level security;
alter table public.vote_sessions  enable row level security;
alter table public.audit_logs     enable row level security;

-- TENANTS: publik boleh baca profil tenant aktif (untuk landing subdomain)
drop policy if exists tenants_public_read on public.tenants;
create policy tenants_public_read on public.tenants
  for select using (is_active = true);

drop policy if exists tenants_owner_insert on public.tenants;
create policy tenants_owner_insert on public.tenants
  for insert with check (owner_id = auth.uid());

drop policy if exists tenants_member_update on public.tenants;
create policy tenants_member_update on public.tenants
  for update using (public.is_tenant_member(id));

-- TENANT MEMBERS
drop policy if exists members_self_read on public.tenant_members;
create policy members_self_read on public.tenant_members
  for select using (user_id = auth.uid() or public.is_tenant_member(tenant_id));

drop policy if exists members_manage on public.tenant_members;
create policy members_manage on public.tenant_members
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- ELECTIONS: publik hanya boleh lihat yang sudah dipublikasikan
drop policy if exists elections_public_read on public.elections;
create policy elections_public_read on public.elections
  for select using (
    status in ('SCHEDULED', 'ONGOING', 'CLOSED') or public.is_tenant_member(tenant_id)
  );

drop policy if exists elections_member_write on public.elections;
create policy elections_member_write on public.elections
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- CANDIDATES: publik boleh baca (paslon memang untuk dilihat)
drop policy if exists candidates_public_read on public.candidates;
create policy candidates_public_read on public.candidates
  for select using (true);

drop policy if exists candidates_member_write on public.candidates;
create policy candidates_member_write on public.candidates
  for all using (public.is_election_member(election_id))
  with check (public.is_election_member(election_id));

-- VOTERS: HANYA panitia. Anon tidak boleh baca sama sekali.
drop policy if exists voters_member_all on public.voters;
create policy voters_member_all on public.voters
  for all using (public.is_election_member(election_id))
  with check (public.is_election_member(election_id));

-- VOTE SESSIONS: tidak ada akses via anon key sama sekali (service role only)
drop policy if exists sessions_no_public on public.vote_sessions;
create policy sessions_no_public on public.vote_sessions
  for select using (false);

-- VOTES: tidak boleh dibaca baris-per-baris oleh siapa pun lewat anon key.
-- Rekap hanya lewat fungsi get_live_count(). Insert hanya lewat cast_vote().
drop policy if exists votes_no_direct_select on public.votes;
create policy votes_no_direct_select on public.votes
  for select using (false);

drop policy if exists votes_no_direct_insert on public.votes;
create policy votes_no_direct_insert on public.votes
  for insert with check (false);

-- AUDIT LOGS
drop policy if exists audit_member_read on public.audit_logs;
create policy audit_member_read on public.audit_logs
  for select using (public.is_tenant_member(tenant_id));

-- RATE LIMITS: hanya boleh diakses lewat service role.
-- Tidak ada policy SELECT/INSERT/UPDATE/DELETE untuk anon maupun authenticated.
-- Server Action bypass RLS via createAdminClient() (lib/supabase/admin).
alter table public.rate_limits enable row level security;

-- =====================================================================
-- 12. REALTIME (untuk live count)
-- Aktifkan juga di Dashboard > Database > Replication.
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.votes;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.voters;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 13. STORAGE BUCKETS
-- Buat manual di Dashboard > Storage, atau jalankan ini:
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('tenant-logos', 'tenant-logos', true),
       ('candidate-photos', 'candidate-photos', true),
       ('election-banners', 'election-banners', true)
on conflict (id) do nothing;

drop policy if exists "public read assets" on storage.objects;
create policy "public read assets" on storage.objects
  for select using (bucket_id in ('tenant-logos','candidate-photos','election-banners'));

drop policy if exists "authenticated upload assets" on storage.objects;
create policy "authenticated upload assets" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('tenant-logos','candidate-photos','election-banners'));

drop policy if exists "authenticated update assets" on storage.objects;
create policy "authenticated update assets" on storage.objects
  for update to authenticated
  using (bucket_id in ('tenant-logos','candidate-photos','election-banners'));

drop policy if exists "authenticated delete assets" on storage.objects;
create policy "authenticated delete assets" on storage.objects
  for delete to authenticated
  using (bucket_id in ('tenant-logos','candidate-photos','election-banners'));
