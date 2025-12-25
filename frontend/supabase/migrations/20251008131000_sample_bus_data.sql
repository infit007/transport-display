-- Sample bus data for UK transport system
-- This creates realistic bus data based on the provided requirements

-- First, get route IDs for reference
with route_data as (
  select id, route_code from public.routes
),
-- Generate sample buses for each route
sample_buses as (
  select 
    'UK07PA' || lpad((row_number() over ())::text, 4, '0') as bus_number,
    route_data.route_code as route_name,
    route_data.id as route_id,
    'active' as status,
    case 
      when route_data.route_code like 'city-%' then 'city'
      else 'intercity'
    end as route_type,
    -- Driver and conductor names (sample)
    'Driver ' || chr(65 + (row_number() over ()) % 26) || chr(65 + ((row_number() over ()) + 1) % 26) as driver_name,
    'Conductor ' || chr(65 + (row_number() over ()) % 26) || chr(65 + ((row_number() over ()) + 2) % 26) as conductor_name,
    -- Phone numbers (sample format)
    '9' || lpad((row_number() over () * 1234567)::text, 9, '0') as driver_phone,
    '9' || lpad((row_number() over () * 7654321)::text, 9, '0') as conductor_phone,
    -- Start and end points
    case 
      when route_data.route_code = 'ddn-delhi' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-chd' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-haldwani' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-massourie' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-joshimath' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-srinager' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-nainital' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-pithoragarh' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-barilly' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-lucknow' then 'Dehradun ISBT'
      when route_data.route_code = 'ddn-kanpur' then 'Dehradun ISBT'
      when route_data.route_code = 'city-haridwar' then 'Haridwar Depot'
      when route_data.route_code = 'city-dehradun' then 'Dehradun Depot'
      else 'Main Depot'
    end as start_point,
    case 
      when route_data.route_code = 'ddn-delhi' then 'Delhi ISBT'
      when route_data.route_code = 'ddn-chd' then 'Chandigarh ISBT'
      when route_data.route_code = 'ddn-haldwani' then 'Haldwani Bus Stand'
      when route_data.route_code = 'ddn-massourie' then 'Massourie Mall Road'
      when route_data.route_code = 'ddn-joshimath' then 'Joshimath Bus Stand'
      when route_data.route_code = 'ddn-srinager' then 'Srinagar Bus Stand'
      when route_data.route_code = 'ddn-nainital' then 'Nainital Bus Stand'
      when route_data.route_code = 'ddn-pithoragarh' then 'Pithoragarh Bus Stand'
      when route_data.route_code = 'ddn-barilly' then 'Bareilly ISBT'
      when route_data.route_code = 'ddn-lucknow' then 'Lucknow ISBT'
      when route_data.route_code = 'ddn-kanpur' then 'Kanpur ISBT'
      when route_data.route_code = 'city-haridwar' then 'Haridwar Depot'
      when route_data.route_code = 'city-dehradun' then 'Dehradun Depot'
      else 'Main Depot'
    end as end_point,
    -- Depot assignment
    case 
      when route_data.route_code like 'city-haridwar%' then 'Haridwar Depot'
      when route_data.route_code like 'city-dehradun%' then 'Dehradun Depot'
      else 'Main Depot Dehradun'
    end as depo,
    -- Category (EV/Small/Big)
    case 
      when (row_number() over ()) % 10 = 0 then 'ev'
      when (row_number() over ()) % 3 = 0 then 'small_bus'
      else 'big_bus'
    end as category,
    -- Sitting capacity based on category
    case 
      when (row_number() over ()) % 10 = 0 then 48  -- EV buses
      when (row_number() over ()) % 3 = 0 then 48   -- Small buses
      when (row_number() over ()) % 2 = 0 then 64   -- Big buses
      else 84  -- Large buses
    end as sitting_capacity,
    -- Running hours
    case 
      when route_data.route_code like 'city-%' then 15  -- City buses run 15 hours
      else 12  -- Intercity buses run 12 hours
    end as running_hours,
    -- Bus type
    case 
      when (row_number() over ()) % 5 = 0 then 'volvo'
      when (row_number() over ()) % 3 = 0 then 'ac'
      else 'non_ac'
    end as bus_type,
    -- GPS coordinates (sample locations)
    case 
      when route_data.route_code = 'ddn-delhi' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-chd' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-haldwani' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-massourie' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-joshimath' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-srinager' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-nainital' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-pithoragarh' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-barilly' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-lucknow' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-kanpur' then 30.3165 + (random() - 0.5) * 0.01
      when route_data.route_code = 'city-haridwar' then 29.9457 + (random() - 0.5) * 0.01
      when route_data.route_code = 'city-dehradun' then 30.3165 + (random() - 0.5) * 0.01
      else 30.3165 + (random() - 0.5) * 0.01
    end as gps_latitude,
    case 
      when route_data.route_code = 'ddn-delhi' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-chd' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-haldwani' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-massourie' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-joshimath' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-srinager' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-nainital' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-pithoragarh' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-barilly' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-lucknow' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'ddn-kanpur' then 78.0322 + (random() - 0.5) * 0.01
      when route_data.route_code = 'city-haridwar' then 78.1642 + (random() - 0.5) * 0.01
      when route_data.route_code = 'city-dehradun' then 78.0322 + (random() - 0.5) * 0.01
      else 78.0322 + (random() - 0.5) * 0.01
    end as gps_longitude,
    now() - interval '1 hour' * (random() * 24) as last_location_update
  from route_data
  cross join generate_series(1, 3) -- 3 buses per route
)
insert into public.buses (
  bus_number, route_name, route_id, status, driver_name, conductor_name,
  driver_phone, conductor_phone, start_point, end_point, depo, category,
  sitting_capacity, running_hours, bus_type, gps_latitude, gps_longitude, last_location_update
)
select * from sample_buses
on conflict (bus_number) do nothing;
