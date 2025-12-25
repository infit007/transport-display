-- Add start/end coordinates to buses for accurate route rendering
alter table public.buses add column if not exists start_latitude decimal(10,8);
alter table public.buses add column if not exists start_longitude decimal(11,8);
alter table public.buses add column if not exists end_latitude decimal(10,8);
alter table public.buses add column if not exists end_longitude decimal(11,8);

-- Optional simple constraints for valid ranges
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_start_latitude_range'
  ) then
    alter table public.buses
      add constraint chk_start_latitude_range
      check (start_latitude is null or (start_latitude >= -90 and start_latitude <= 90));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_start_longitude_range'
  ) then
    alter table public.buses
      add constraint chk_start_longitude_range
      check (start_longitude is null or (start_longitude >= -180 and start_longitude <= 180));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_end_latitude_range'
  ) then
    alter table public.buses
      add constraint chk_end_latitude_range
      check (end_latitude is null or (end_latitude >= -90 and end_latitude <= 90));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_end_longitude_range'
  ) then
    alter table public.buses
      add constraint chk_end_longitude_range
      check (end_longitude is null or (end_longitude >= -180 and end_longitude <= 180));
  end if;
end $$;

