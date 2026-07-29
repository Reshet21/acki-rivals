-- Migration: store player wallet names alongside PvP game records
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS host_name text,
  ADD COLUMN IF NOT EXISTS guest_name text;
