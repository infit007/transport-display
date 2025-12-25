-- Update buses table with comprehensive fields
alter table public.buses add column if not exists driver_name text;
alter table public.buses add column if not exists conductor_name text;
alter table public.buses add column if not exists driver_phone text;
alter table public.buses add column if not exists conductor_phone text;
alter table public.buses add column if not exists start_point text;
alter table public.buses add column if not exists end_point text;
alter table public.buses add column if not exists depo text;
alter table public.buses add column if not exists category text check (category in ('ev', 'small_bus', 'big_bus'));
alter table public.buses add column if not exists sitting_capacity integer;
alter table public.buses add column if not exists running_hours integer check (running_hours in (12, 15, 24));
alter table public.buses add column if not exists bus_type text check (bus_type in ('volvo', 'ac', 'non_ac'));

-- Create routes table for better organization
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_code text not null unique, -- e.g., 'ddn-delhi', 'ddn-chd'
  route_name text not null, -- e.g., 'Dehradun to Delhi'
  start_city text not null,
  end_city text not null,
  distance_km integer,
  estimated_duration_hours numeric(4,2),
  created_at timestamptz default now()
);

alter table public.routes enable row level security;

-- Link buses to routes
alter table public.buses add column if not exists route_id uuid references public.routes(id);

-- RLS policies for routes
create policy if not exists "routes_read_auth"
  on public.routes for select to authenticated using (true);

create policy if not exists "routes_admin_all"
  on public.routes for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Insert UK routes
insert into public.routes (route_code, route_name, start_city, end_city, distance_km, estimated_duration_hours) values
('ddn-delhi', 'Dehradun to Delhi', 'Dehradun', 'Delhi', 250, 6.5),
('ddn-chd', 'Dehradun to Chandigarh', 'Dehradun', 'Chandigarh', 180, 4.5),
('ddn-haldwani', 'Dehradun to Haldwani', 'Dehradun', 'Haldwani', 80, 2.0),
('ddn-massourie', 'Dehradun to Massourie', 'Dehradun', 'Massourie', 35, 1.5),
('ddn-joshimath', 'Dehradun to Joshimath', 'Dehradun', 'Joshimath', 250, 8.0),
('ddn-srinager', 'Dehradun to Srinagar', 'Dehradun', 'Srinagar', 200, 5.5),
('ddn-nainital', 'Dehradun to Nainital', 'Dehradun', 'Nainital', 70, 2.5),
('ddn-pithoragarh', 'Dehradun to Pithoragarh', 'Dehradun', 'Pithoragarh', 180, 5.0),
('ddn-barilly', 'Dehradun to Bareilly', 'Dehradun', 'Bareilly', 120, 3.0),
('ddn-lucknow', 'Dehradun to Lucknow', 'Dehradun', 'Lucknow', 200, 5.0),
('ddn-kanpur', 'Dehradun to Kanpur', 'Dehradun', 'Kanpur', 180, 4.5),
('city-haridwar', 'City Bus Haridwar', 'Haridwar', 'Haridwar', 0, 0),
('city-dehradun', 'City Bus Dehradun', 'Dehradun', 'Dehradun', 0, 0),
('city-uk', 'City Bus Uttarakhand', 'Various', 'Various', 0, 0)
on conflict (route_code) do nothing;
