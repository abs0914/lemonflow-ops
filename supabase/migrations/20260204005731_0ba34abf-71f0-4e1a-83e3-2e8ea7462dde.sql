-- Add debtor sync fields to stores table
-- These fields support AutoCount debtor synchronization

-- Add sync_error_message for tracking sync errors (matches pattern in purchase_orders/sales_orders)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS sync_error_message text;

-- Add city field (from domain model)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS city text;

-- Add region field for reporting/grouping (from domain model)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS region text;

-- Add opened_date for tracking when store was registered (from domain model)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS opened_date date;

-- Add comments for documentation
COMMENT ON COLUMN public.stores.sync_error_message IS 'Error message from last AutoCount sync attempt';
COMMENT ON COLUMN public.stores.city IS 'City/Municipality of the store';
COMMENT ON COLUMN public.stores.region IS 'Region/area grouping for reporting';
COMMENT ON COLUMN public.stores.opened_date IS 'Date when the store was opened/registered';