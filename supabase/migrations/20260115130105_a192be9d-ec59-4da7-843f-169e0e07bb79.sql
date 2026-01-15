-- Add low stock threshold column to components table
ALTER TABLE public.components 
ADD COLUMN IF NOT EXISTS low_stock_threshold numeric DEFAULT 10;

-- Add low stock threshold to raw_materials as well for consistency
ALTER TABLE public.raw_materials 
ADD COLUMN IF NOT EXISTS low_stock_threshold numeric DEFAULT 10;

-- Update existing items with default threshold
UPDATE public.components SET low_stock_threshold = 10 WHERE low_stock_threshold IS NULL;
UPDATE public.raw_materials SET low_stock_threshold = 10 WHERE low_stock_threshold IS NULL;