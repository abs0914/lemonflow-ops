-- Migration: Add AutoCount sync fields to stores table
-- Date: 2026-02-03
-- Purpose: Enable tracking of AutoCount sync status for stores (debtors)

-- Add credit_limit field for AutoCount CreditLimit
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;

-- Add autocount_synced flag to track sync status
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS autocount_synced BOOLEAN DEFAULT false;

-- Add last_synced_at timestamp
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create index on autocount_synced for efficient querying of unsynced stores
CREATE INDEX IF NOT EXISTS idx_stores_autocount_synced ON public.stores(autocount_synced);

-- Add comment for documentation
COMMENT ON COLUMN public.stores.credit_limit IS 'Credit limit mapped from AutoCount CreditLimit field';
COMMENT ON COLUMN public.stores.autocount_synced IS 'Whether this store has been synced to AutoCount as a debtor';
COMMENT ON COLUMN public.stores.last_synced_at IS 'Timestamp of last successful sync with AutoCount';

