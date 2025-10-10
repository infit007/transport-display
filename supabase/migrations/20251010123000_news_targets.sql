-- Add targeting columns to news_feeds
alter table public.news_feeds
  add column if not exists target_depots text[] default '{}'::text[],
  add column if not exists target_device_ids text[] default '{}'::text[];

-- Optional index to speed up filtering if used in queries later
create index if not exists idx_news_feeds_target_depots on public.news_feeds using gin (target_depots);
create index if not exists idx_news_feeds_target_device_ids on public.news_feeds using gin (target_device_ids);


