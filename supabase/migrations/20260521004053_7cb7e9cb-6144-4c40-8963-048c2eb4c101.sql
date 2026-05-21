ALTER TABLE public.assembly_orders ADD COLUMN IF NOT EXISTS raw_material_id uuid;
ALTER TABLE public.assembly_orders ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.assembly_orders DROP CONSTRAINT IF EXISTS assembly_orders_target_check;
ALTER TABLE public.assembly_orders ADD CONSTRAINT assembly_orders_target_check
  CHECK ((product_id IS NOT NULL)::int + (raw_material_id IS NOT NULL)::int = 1);