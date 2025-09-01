-- Google tokens storage (service-role only)
create table if not exists google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_user_id text,
  access_token text,
  refresh_token text not null,
  expiry_ts timestamptz not null,
  scope text,
  token_type text default 'Bearer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table google_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'google_tokens' and policyname = 'service-only'
  ) then
    create policy "service-only"
    on public.google_tokens for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end $$;
