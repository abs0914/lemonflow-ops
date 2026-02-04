-- Add sync tracking columns to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS autocount_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;