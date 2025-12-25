-- FleetSignage Manager Role Setup - Step 1
-- Run this FIRST in Supabase SQL Editor

-- Add manager role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
