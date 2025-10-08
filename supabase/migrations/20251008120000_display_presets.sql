-- Display presets for screens
create table if not exists public.display_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  video_url text,
  youtube_id text,
  lat numeric(10,6),
  lng numeric(10,6),
  zoom int,
  next_stop text,
  destination text,
  news text,
  show_route boolean default true,
  show_trail boolean default false,
  device_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.display_presets enable row level security;

-- RLS: anyone authenticated can read; only admins can write
create policy if not exists "display_presets_read" on public.display_presets
  for select to authenticated using (true);

create policy if not exists "display_presets_write_admin" on public.display_presets
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- trigger to update updated_at
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists update_display_presets_updated_at on public.display_presets;
create trigger update_display_presets_updated_at
  before update on public.display_presets
  for each row execute function public.update_updated_at_column();


