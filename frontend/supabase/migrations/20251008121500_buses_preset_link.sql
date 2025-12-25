alter table public.buses add column if not exists preset_id uuid references public.display_presets(id) on delete set null;


